"""Port of shared/mathAst.ts; no function names or executable nodes exist."""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import math

from .limits import MAX_AST_NODES, MAX_INPUT_LENGTH, MAX_SYMBOLS


class MathAstParseError(ValueError):
    def __init__(self, message: str, position: int = 0):
        super().__init__(message)
        self.position = position


@dataclass
class Token:
    kind: str
    value: object
    position: int


RELATIONS = {"=": "eq", "<": "lt", "<=": "le", ">": "gt", ">=": "ge"}
TOPICS = {"arithmetic", "fractions", "percentages", "linear_equation"}


def parse_json_integer(source):
    """Decode decimal/exponent JSON numbers without a binary-float step."""
    try:
        number = Decimal(source)
        if (not number.is_finite() or number < 0 or number >= 10 ** MAX_INPUT_LENGTH
                or number != number.to_integral_value()):
            raise MathAstParseError("invalid nonnegative integer literal")
        return int(number)
    except InvalidOperation:
        raise MathAstParseError("invalid nonnegative integer literal") from None


def integer_literal(number):
    # For Python callers, use the same decimal spelling that JSON encoders
    # emit. HTTP itself uses parse_json_integer before any float is created.
    if type(number) is float and math.isfinite(number):
        return parse_json_integer(str(number))
    if type(number) is not int or number < 0 or number >= 10 ** MAX_INPUT_LENGTH:
        raise MathAstParseError("invalid nonnegative integer literal")
    return number


def tokenize(source: str) -> list[Token]:
    if not isinstance(source, str):
        raise MathAstParseError("input must be text")
    if not source:
        raise MathAstParseError("empty input")
    if len(source) > MAX_INPUT_LENGTH:
        raise MathAstParseError("input too long", MAX_INPUT_LENGTH)
    tokens = []
    i = 0
    while i < len(source):
        c = source[i]
        if c in " \t\n":
            i += 1
            continue
        start = i
        if "0" <= c <= "9":
            while i < len(source) and "0" <= source[i] <= "9":
                i += 1
            tokens.append(Token("num", int(source[start:i]), start))
            continue
        if "a" <= c <= "z" or "A" <= c <= "Z":
            tokens.append(Token("sym", c, start))
        elif c in "+-*/^()=<>":
            if c in "<>" and source[i + 1:i + 2] == "=":
                c += "="
                i += 1
            tokens.append(Token("op", c, start))
        else:
            raise MathAstParseError(f"unexpected character {c!r}", start)
        i += 1
    return tokens


class _Parser:
    def __init__(self, tokens, end, budget):
        self.tokens, self.end, self.budget = tokens, end, budget
        self.index = 0

    def peek(self):
        return self.tokens[self.index] if self.index < len(self.tokens) else None

    def take(self):
        token = self.peek()
        if token is None:
            raise MathAstParseError("unexpected end of input", self.end)
        self.index += 1
        return token

    def at(self, *operators):
        token = self.peek()
        return token is not None and token.kind == "op" and token.value in operators

    def node(self, kind, **fields):
        self.budget[0] += 1
        if self.budget[0] > MAX_AST_NODES:
            raise MathAstParseError("expression too complex", self.end)
        return {"kind": kind, **fields}

    def expect_end(self):
        if self.peek() is not None:
            raise MathAstParseError("unexpected trailing input", self.peek().position)

    def expression(self):
        node = self.term()
        while self.at("+", "-"):
            operator = self.take().value
            node = self.node("add" if operator == "+" else "sub", left=node, right=self.term())
        return node

    def term(self):
        node = self.factor()
        while True:
            if self.at("*", "/"):
                operator = self.take().value
                node = self.node("mul" if operator == "*" else "div", left=node, right=self.factor())
            elif self.peek() is not None and self.peek().kind in {"num", "sym", "node"}:
                node = self.node("mul", left=node, right=self.factor())
            else:
                return node

    def factor(self):
        node = self.unary()
        if self.at("^"):
            self.take()
            node = self.node("pow", base=node, exponent=self.unary())
        return node

    def unary(self):
        negatives = 0
        while self.at("-"):
            self.take()
            negatives += 1
        node = self.primary()
        for _ in range(negatives):
            node = self.node("neg", operand=node)
        return node

    def primary(self):
        token = self.take()
        if token.kind == "node":
            return token.value
        if token.kind == "sym":
            return self.node("symbol", name=token.value)
        if token.kind == "num":
            if self.at("/") and self.index + 1 < len(self.tokens) and self.tokens[self.index + 1].kind == "num":
                self.take()
                return self.node("frac", numerator=token.value, denominator=self.take().value)
            return self.node("num", value=token.value)
        raise MathAstParseError("unexpected token", token.position)


def parse_math_statement(source: str) -> dict:
    tokens = tokenize(source)
    # An explicit group stack avoids Python recursion limits even for 199
    # nested parentheses (a valid 200-node input). Each group still uses the
    # same recursive-descent expr/term/factor/unary/primary productions.
    groups = [[]]
    budget = [0]
    for token in tokens:
        if token.kind == "op" and token.value == "(":
            groups.append([])
        elif token.kind == "op" and token.value == ")":
            if len(groups) == 1:
                raise MathAstParseError("unexpected token", token.position)
            parser = _Parser(groups.pop(), token.position, budget)
            inner = parser.expression()
            parser.expect_end()
            groups[-1].append(Token("node", parser.node("paren", inner=inner), token.position))
        else:
            groups[-1].append(token)
    if len(groups) != 1:
        raise MathAstParseError("expected ')'", len(source))
    parser = _Parser(groups[0], len(source), budget)
    lhs = parser.expression()
    if parser.at(*RELATIONS):
        op = RELATIONS[parser.take().value]
        statement = {"form": "relation", "value": {"op": op, "lhs": lhs, "rhs": parser.expression()}}
    else:
        statement = {"form": "expression", "value": lhs}
    parser.expect_end()
    validate_statement(statement)
    return statement


def _object(value, fields):
    if type(value) is not dict or set(value) != set(fields):
        raise MathAstParseError("invalid AST object fields")


def _edge_character(node, first):
    """Lexical edge of a node, for implicit-product separator accounting."""
    steps = 0
    while type(node) is dict:
        steps += 1
        if steps > MAX_AST_NODES:
            raise MathAstParseError("expression too complex")
        kind = node.get("kind")
        if type(kind) is not str:
            return ""
        if kind in {"num", "frac"}:
            return "0"
        if kind == "symbol":
            return "x"
        if kind == "paren":
            return "(" if first else ")"
        if kind == "neg":
            if first:
                return "-"
            node = node.get("operand")
        elif kind == "pow":
            node = node.get("base" if first else "exponent")
        elif kind in {"add", "sub", "mul", "div"}:
            node = node.get("left" if first else "right")
        else:
            return ""
    return ""


def validate_statement(statement: object) -> dict:
    """Validate bridge JSON as rigorously as text, before any math calls."""
    if isinstance(statement, str):
        # Invalid text receives the same precise parser errors, but HTTP only
        # accepts the contract's tagged MathStatement objects, not raw text.
        parse_math_statement(statement)
        raise MathAstParseError("expected MathStatement object")
    _object(statement, ("form", "value"))
    form, value = statement["form"], statement["value"]
    if form == "expression":
        pending = [value]
    elif form == "relation":
        _object(value, ("op", "lhs", "rhs"))
        if type(value["op"]) is not str or value["op"] not in RELATIONS.values():
            raise MathAstParseError("unknown relation operator")
        pending = [value["lhs"], value["rhs"]]
    else:
        raise MathAstParseError("unknown statement form")
    count = 0
    source_chars = (2 if value["op"] in {"le", "ge"} else 1) if form == "relation" else 0
    symbols = set()
    child_fields = {"neg": ("operand",), "paren": ("inner",), "pow": ("base", "exponent"),
                    **{kind: ("left", "right") for kind in ("add", "sub", "mul", "div")}}
    while pending:
        node = pending.pop()
        count += 1
        if count > MAX_AST_NODES:
            raise MathAstParseError("expression too complex")
        if type(node) is not dict or type(node.get("kind")) is not str:
            raise MathAstParseError("invalid AST node")
        kind = node["kind"]
        if kind in child_fields:
            fields = child_fields[kind]
            _object(node, ("kind", *fields))
            pending.extend(node[field] for field in fields)
            source_chars += 2 if kind == "paren" else (0 if kind == "mul" else 1)
            if kind == "mul":
                first = _edge_character(node["right"], True)
                if first == "-" or (first == "0" and _edge_character(node["left"], False) == "0"):
                    source_chars += 1
        elif kind in {"num", "frac"}:
            fields = ("value",) if kind == "num" else ("numerator", "denominator")
            _object(node, ("kind", *fields))
            for field in fields:
                number = integer_literal(node[field])
                source_chars += len(str(number))
            source_chars += kind == "frac"
        elif kind == "symbol":
            _object(node, ("kind", "name"))
            name = node["name"]
            if type(name) is not str or len(name) != 1 or not ("a" <= name <= "z" or "A" <= name <= "Z"):
                raise MathAstParseError("invalid single-letter symbol")
            symbols.add(name)
            source_chars += 1
            if len(symbols) > MAX_SYMBOLS:
                raise MathAstParseError("too many distinct symbols")
        else:
            raise MathAstParseError("unknown AST node kind")
        if source_chars > MAX_INPUT_LENGTH:
            raise MathAstParseError("input too long")
    return statement


def validate_request(payload):
    required = {"topic", "task_statement", "previous_step", "current_step"}
    if type(payload) is not dict or set(payload) != required:
        raise MathAstParseError("expected topic, task_statement, previous_step, current_step")
    if type(payload["topic"]) is not str or payload["topic"] not in TOPICS:
        raise MathAstParseError("unknown topic")
    for field in ("task_statement", "previous_step", "current_step"):
        if payload[field] is None and field != "current_step":
            continue
        validate_statement(payload[field])
    if payload["previous_step"] is None and payload["task_statement"] is None:
        raise MathAstParseError("a previous step or task statement is required")
    return payload
