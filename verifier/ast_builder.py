"""Allowlisted construction and conservative equivalence over real numbers.

Domain hazards are recorded BEFORE automatic algebraic cancellation. Sampling
may establish a counterexample, but is never used to claim equivalence.
"""

from itertools import islice, product

import sympy as sp

from .limits import result
from .parser import MathAstParseError, integer_literal, parse_math_statement, validate_request, validate_statement

RELATION_BUILDERS = {"eq": sp.Eq, "lt": sp.Lt, "le": sp.Le, "gt": sp.Gt, "ge": sp.Ge}


class UndefinedMath(ValueError):
    pass


class _Builder:
    def __init__(self):
        self.domain_notes = []

    def denominator(self, expression):
        if expression.is_zero is True:
            raise UndefinedMath("Division by zero is undefined.")
        if expression.free_symbols and expression.is_zero is not False:
            self.domain_notes.append("A symbolic denominator must be nonzero; no domain restriction was supplied.")

    def node(self, node):
        kind = node["kind"]
        if kind == "num":
            value = sp.Integer(integer_literal(node["value"]))
        elif kind == "frac":
            if node["denominator"] == 0:
                raise UndefinedMath("Division by zero is undefined.")
            value = sp.Rational(integer_literal(node["numerator"]), integer_literal(node["denominator"]))
        elif kind == "symbol":
            value = sp.Symbol(node["name"], real=True)
        elif kind == "paren":
            value = self.node(node["inner"])
        elif kind == "neg":
            value = sp.Mul(sp.Integer(-1), self.node(node["operand"]))
        elif kind in {"add", "sub", "mul", "div"}:
            left, right = self.node(node["left"]), self.node(node["right"])
            if kind == "add":
                value = sp.Add(left, right)
            elif kind == "sub":
                value = sp.Add(left, sp.Mul(sp.Integer(-1), right))
            elif kind == "mul":
                value = sp.Mul(left, right)
            else:
                self.denominator(right)
                value = sp.Mul(left, sp.Pow(right, sp.Integer(-1)))
        elif kind == "pow":
            base, exponent = self.node(node["base"]), self.node(node["exponent"])
            if exponent.is_integer is not True:
                self.domain_notes.append("A noninteger or symbolic exponent needs an explicit real domain/branch restriction.")
            elif exponent.is_negative is True:
                self.denominator(base)
            elif exponent.is_zero is True and base.is_zero is not False:
                self.domain_notes.append("Zero to the zeroth power may occur; a nonzero base restriction is required.")
            value = sp.Pow(base, exponent)
        else:
            raise MathAstParseError("unknown AST node kind")
        if value.is_finite is False or value.has(sp.zoo, sp.nan, sp.oo, -sp.oo):
            raise UndefinedMath("The expression is undefined or nonfinite.")
        if value.is_real is False:
            self.domain_notes.append("The expression is not real on the stated domain.")
        return value

    def statement(self, statement):
        value = statement["value"]
        if statement["form"] == "expression":
            return self.node(value)
        return RELATION_BUILDERS[value["op"]](self.node(value["lhs"]), self.node(value["rhs"]), evaluate=False)


def build_statement(statement):
    """Public safe construction API; raises on undefined or restricted forms."""
    validate_statement(statement)
    builder = _Builder()
    value = builder.statement(statement)
    if builder.domain_notes:
        raise UndefinedMath(" ".join(dict.fromkeys(builder.domain_notes)))
    return value


def _solution_set(relation, symbols):
    if not symbols:
        truth = sp.simplify(relation)
        if truth is sp.true:
            return sp.S.Reals
        if truth is sp.false:
            return sp.S.EmptySet
        return None
    if len(symbols) != 1:
        return None
    symbol = symbols[0]
    if isinstance(relation, sp.Equality):
        solutions = sp.solveset(sp.Add(relation.lhs, -relation.rhs), symbol, domain=sp.S.Reals)
    else:
        solutions = sp.solve_univariate_inequality(relation, symbol, relational=False, domain=sp.S.Reals)
    if solutions.has(sp.ConditionSet):
        return None
    return solutions


def _proportional_relations(left, right):
    """Prove multivariate transformations only with a nonzero constant scale."""
    left_eq, right_eq = isinstance(left, sp.Equality), isinstance(right, sp.Equality)
    if left_eq != right_eq:
        return False
    if not left_eq and (isinstance(left, (sp.Lt, sp.Gt)) != isinstance(right, (sp.Lt, sp.Gt))):
        return False
    a, b = sp.expand(left.lhs - left.rhs), sp.expand(right.lhs - right.rhs)
    if isinstance(left, (sp.Gt, sp.Ge)):
        a = -a
    if isinstance(right, (sp.Gt, sp.Ge)):
        b = -b
    if a == b:
        return True
    if a == 0 or b == 0:
        return False
    ratio = sp.cancel(a / b)
    if ratio.free_symbols or ratio.is_finite is not True:
        return False
    return ratio.is_zero is False if left_eq else ratio.is_positive is True


def _counterexample(left, right, symbols, relations, extra=()):
    if not symbols:
        return None
    candidates = [0, 1, -1, 2, -2, 3, -3, 4, 5, 7, 10]
    if len(symbols) == 1:
        candidates += [int(x) for x in extra if x.is_Integer and abs(x) < 10 ** 12]
    for numbers in islice(product(candidates, repeat=len(symbols)), 128):
        substitutions = dict(zip(symbols, numbers))
        a, b = left.subs(substitutions), right.subs(substitutions)
        if relations:
            a, b = sp.simplify(a), sp.simplify(b)
            differs = (a is sp.true and b is sp.false) or (a is sp.false and b is sp.true)
        else:
            differs = sp.simplify(a - b).is_zero is False
        if differs:
            return {"symbol_values": {str(s): n for s, n in substitutions.items()}}
    return None


def _compare(previous, current):
    builder = _Builder()
    left, right = builder.statement(previous), builder.statement(current)
    if builder.domain_notes:
        return result("ambiguous_domain", "domain_restriction_required", " ".join(dict.fromkeys(builder.domain_notes)))
    if previous["form"] != current["form"]:
        return result("invalid", "statement_form_mismatch", "Cannot compare a bare expression to a relation.")
    symbols = sorted(left.free_symbols | right.free_symbols, key=str)
    relations = previous["form"] == "relation"
    extra = []
    if not relations:
        difference = sp.simplify(left - right)
        if difference == 0:
            return result("equivalent", "expressions_equal", "The real expressions are identically equal.")
        equal = difference.equals(0)
        if equal is True:
            return result("equivalent", "expressions_equal", "The real expressions are identically equal.")
        different = equal is False
    else:
        a, b = _solution_set(left, symbols), _solution_set(right, symbols)
        if a is not None and b is not None:
            if a == b:
                return result("equivalent", "solution_sets_equal", "The relations have the same real solution set.")
            different = a.symmetric_difference(b).is_empty is False
            for solutions in (a, b):
                if isinstance(solutions, sp.FiniteSet):
                    extra.extend(solutions)
        elif _proportional_relations(left, right):
            return result("equivalent", "constant_rescaling", "A domain-safe constant rescaling preserves the relation.")
        else:
            different = False
    witness = _counterexample(left, right, symbols, relations, extra)
    if different or witness is not None:
        return result("not_equivalent", "solution_sets_differ" if relations else "expressions_differ",
                      "The transformation changes the real solution set." if relations else "The expressions differ.", witness)
    return result("ambiguous_domain", "equivalence_undetermined", "Equivalence could not be proved in the supported real domain.")


def verify_step(payload):
    """Trusted worker entry point; production callers MUST use run_verification."""
    try:
        validate_request(payload)
        previous = payload["previous_step"] if payload["previous_step"] is not None else payload["task_statement"]
        return _compare(previous, payload["current_step"])
    except MathAstParseError as error:
        return result("invalid", "invalid_input", f"{error} at position {error.position}.")
    except UndefinedMath as error:
        return result("invalid", "undefined_expression", str(error))
    except (NotImplementedError, ValueError, TypeError, RecursionError):
        return result("ambiguous_domain", "unsupported_math", "The supplied real expressions could not be compared safely.")


def verify_pair(previous, current, *, topic="linear_equation"):
    """Convenience for constrained text tests/CLI; HTTP still requires AST JSON."""
    try:
        previous = parse_math_statement(previous) if isinstance(previous, str) else previous
        current = parse_math_statement(current) if isinstance(current, str) else current
    except MathAstParseError as error:
        return result("invalid", "invalid_input", f"{error} at position {error.position}.")
    return verify_step({"topic": topic, "task_statement": None, "previous_step": previous, "current_step": current})
