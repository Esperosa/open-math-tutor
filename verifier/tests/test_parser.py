import pytest

from verifier.limits import MAX_AST_NODES, MAX_INPUT_LENGTH, MAX_SYMBOLS
from verifier.parser import MathAstParseError, parse_math_statement, validate_statement


def expression(source):
    return parse_math_statement(source)["value"]


def test_exact_linear_ast():
    assert parse_math_statement("2(x+3)=14") == {
        "form": "relation", "value": {"op": "eq", "lhs": {
            "kind": "mul", "left": {"kind": "num", "value": 2},
            "right": {"kind": "paren", "inner": {"kind": "add",
                "left": {"kind": "symbol", "name": "x"}, "right": {"kind": "num", "value": 3}}}},
            "rhs": {"kind": "num", "value": 14}}}


@pytest.mark.parametrize("operator,tag", [("=", "eq"), ("<", "lt"), ("<=", "le"), (">", "gt"), (">=", "ge")])
def test_relation_operators(operator, tag):
    assert parse_math_statement(f"x{operator}1")["value"]["op"] == tag


def test_fraction_is_single_node_even_with_whitespace():
    assert expression("1 / 2") == {"kind": "frac", "numerator": 1, "denominator": 2}
    assert expression("1/x")["kind"] == "div"
    assert expression("1/-2")["kind"] == "div"
    assert expression("1/2/3")["left"]["kind"] == "frac"
    assert expression("1/2^3")["base"]["kind"] == "frac"


def test_precedence_matches_ts_not_conventional_unary_precedence():
    assert expression("-x^2") == {"kind": "pow", "base": {
        "kind": "neg", "operand": {"kind": "symbol", "name": "x"}}, "exponent": {"kind": "num", "value": 2}}
    assert expression("2+3*4")["right"]["kind"] == "mul"
    assert expression("2^(-3)")["exponent"]["kind"] == "paren"
    assert expression("--x")["operand"]["kind"] == "neg"


@pytest.mark.parametrize("source", ["2x", "x(x+1)", "(x+1)(x-1)", "2 3", "sin(x)"])
def test_implicit_multiplication(source):
    assert expression(source)["kind"] == "mul"


def test_no_function_node():
    value = expression("sin(x)")
    assert value == {"kind": "mul", "left": {"kind": "mul", "left": {
        "kind": "mul", "left": {"kind": "symbol", "name": "s"},
        "right": {"kind": "symbol", "name": "i"}}, "right": {"kind": "symbol", "name": "n"}},
        "right": {"kind": "paren", "inner": {"kind": "symbol", "name": "x"}}}


@pytest.mark.parametrize("source", ["", " ", "+1", "1.2", "10%", "x!=1", "x==1", "x=1=2", "x<1<2",
                                     "2^3^4", "2**3", "()", "(1", "1)", "(x=1)", "x,1", "x[0]",
                                     "x\r", "π", "１２", "1e3.0"])
def test_outside_grammar_rejected(source):
    with pytest.raises(MathAstParseError):
        parse_math_statement(source)


def test_ascii_symbols_and_whitespace():
    assert expression(" \tA\n")["name"] == "A"
    parse_math_statement("abcXYZ")
    with pytest.raises(MathAstParseError, match="too many distinct symbols"):
        parse_math_statement("abcXYZd")


def test_text_limits_exact_boundaries_without_recursion_failures():
    assert (MAX_INPUT_LENGTH, MAX_AST_NODES, MAX_SYMBOLS) == (400, 200, 6)
    parse_math_statement("9" * 400)
    parse_math_statement("(" * 199 + "1" + ")" * 199)
    parse_math_statement("-" * 199 + "1")
    parse_math_statement("+".join(["1"] * 100))
    for source, message in [("9" * 401, "input too long"), ("-" * 200 + "1", "expression too complex"),
                            ("+".join(["1"] * 101), "expression too complex")]:
        with pytest.raises(MathAstParseError, match=message):
            parse_math_statement(source)


def test_ast_node_limit():
    node = {"kind": "symbol", "name": "x"}
    for _ in range(200):
        node = {"kind": "neg", "operand": node}
    with pytest.raises(MathAstParseError, match="expression too complex"):
        validate_statement({"form": "expression", "value": node})


def test_ast_cannot_bypass_source_budget_with_many_large_literals():
    node = {"kind": "add", "left": {"kind": "num", "value": 10 ** 200},
            "right": {"kind": "num", "value": 10 ** 200}}
    with pytest.raises(MathAstParseError, match="input too long"):
        validate_statement({"form": "expression", "value": node})


def test_integral_json_numbers_and_fraction_fields_are_accepted():
    validate_statement({"form": "expression", "value": {"kind": "frac", "numerator": 1.0, "denominator": 2.0}})


def test_cyclic_ast_rejection():
    node = {"kind": "neg"}
    node["operand"] = node
    with pytest.raises(MathAstParseError, match="expression too complex"):
        validate_statement({"form": "expression", "value": node})
    node = {"kind": "mul", "left": {"kind": "num", "value": 1}}
    node["right"] = node
    with pytest.raises(MathAstParseError, match="expression too complex"):
        validate_statement({"form": "expression", "value": node})


def test_relation_and_product_separators_count_toward_ast_budget():
    for source in ["9" * 399 + "=1", "9" * 200 + " " + "9" * 200]:
        with pytest.raises(MathAstParseError, match="input too long"):
            parse_math_statement(source)
    for statement in [
        {"form": "relation", "value": {"op": "eq", "lhs": {"kind": "num", "value": 10 ** 398},
                                        "rhs": {"kind": "num", "value": 1}}},
        {"form": "expression", "value": {"kind": "mul", "left": {"kind": "num", "value": 10 ** 199},
                                          "right": {"kind": "num", "value": 10 ** 199}}},
    ]:
        with pytest.raises(MathAstParseError, match="input too long"):
            validate_statement(statement)


def test_error_position_is_available():
    with pytest.raises(MathAstParseError) as caught:
        parse_math_statement("x;1")
    assert caught.value.position == 1
