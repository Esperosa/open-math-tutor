import pytest
import sympy as sp

from verifier.ast_builder import build_statement, verify_pair, verify_step
from verifier.parser import parse_math_statement


@pytest.mark.parametrize("previous,current,topic", [
    ("2+3*4", "14", "arithmetic"),
    ("-3-(-5)", "2", "arithmetic"),
    ("-(2+3)", "-5", "arithmetic"),
    ("1/2+1/3", "5/6", "fractions"),
    ("1/-2", "-1/2", "fractions"),
    ("25/100*80", "20", "percentages"),
    ("2(x+3)=14", "2x+6=14", "linear_equation"),
    ("2(x+3)=14", "x=4", "linear_equation"),
    ("-2(x+3)=14", "-2x-6=14", "linear_equation"),
    ("-2(x-3)", "-2x+6", "arithmetic"),
    ("(2x+6)/2=7", "x+3=7", "linear_equation"),
    ("(x+2)-(x+2)", "0", "arithmetic"),
    ("-2x<6", "x>-3", "linear_equation"),
    ("-x<=2", "x>=-2", "linear_equation"),
    ("-2x>6", "x<-3", "linear_equation"),
    ("-x>=2", "x<=-2", "linear_equation"),
    ("x<1", "-x>-1", "linear_equation"),
    ("x^2=1", "(x-1)(x+1)=0", "linear_equation"),
    ("x=x", "1=1", "linear_equation"),
    ("1=2", "2=3", "arithmetic"),
    ("x+y=1", "x=1-y", "linear_equation"),
    ("x+y<1", "-x-y>-1", "linear_equation"),
    ("(x^2+1)/(x^2+1)", "1", "arithmetic"),
])
def test_correct_transformations(previous, current, topic):
    response = verify_pair(previous, current, topic=topic)
    assert response["status"] == "equivalent", response
    assert set(response) == {"status", "reason", "detail", "counterexample"}


@pytest.mark.parametrize("previous,current,topic", [
    ("2+3*4", "20", "arithmetic"),
    ("-3-(-5)", "-8", "arithmetic"),
    ("-(2+3)", "-2+3", "arithmetic"),
    ("1/2+1/3", "2/5", "fractions"),
    ("25/100*80", "25", "percentages"),
    ("2(x+3)=14", "2x+3=14", "linear_equation"),
    ("-2(x+3)=14", "-2x+6=14", "linear_equation"),
    ("-2(x-3)", "-2x-6", "arithmetic"),
    ("(2x+6)/2=7", "x+6=7", "linear_equation"),
    ("(x+2)-(x+2)", "4", "arithmetic"),
    ("-2x<6", "x<-3", "linear_equation"),
    ("-x<=2", "x<=-2", "linear_equation"),
    ("-2x>6", "x>-3", "linear_equation"),
    ("-x>=2", "x>=-2", "linear_equation"),
    ("x<=1", "x<1", "linear_equation"),
    ("x^2=1", "x=1", "linear_equation"),
    ("x=1", "0=0", "linear_equation"),
    ("x+y=1", "x=y", "linear_equation"),
    ("x+y<1", "x+y>1", "linear_equation"),
])
def test_incorrect_transformations(previous, current, topic):
    response = verify_pair(previous, current, topic=topic)
    assert response["status"] == "not_equivalent", response


@pytest.mark.parametrize("source", ["1/0", "0/0", "x/(2-2)", "1/(x-x)", "0^-1", "0*(1/0)", "(1/0)^0"])
def test_division_by_zero(source):
    response = verify_pair(source, "0")
    assert response["status"] == "invalid", response
    assert response["reason"] == "undefined_expression"


@pytest.mark.parametrize("previous,current", [
    ("x/x", "1"), ("(x^2-1)/(x-1)", "x+1"),
    ("(x^2-1)/(x-1)=0", "x+1=0"), ("0*(1/x)", "0"),
    ("x^-1", "1/x"), ("x^(1/2)", "x^(1/2)"),
    ("(-1)^(1/2)", "1"), ("x^0", "1"), ("0^0", "1"),
    ("x^x", "x^x"), ("1/x=1/x", "1=1"),
])
def test_missing_domain_restrictions(previous, current):
    response = verify_pair(previous, current)
    assert response["status"] == "ambiguous_domain", response
    assert response["reason"] == "domain_restriction_required"
    assert response["detail"]


def test_builds_exact_sympy_objects_and_real_symbols():
    assert build_statement(parse_math_statement("1/2")) == sp.Rational(1, 2)
    symbol = build_statement(parse_math_statement("x"))
    assert symbol.is_real is True
    assert isinstance(build_statement(parse_math_statement("x=1")), sp.Equality)
    assert build_statement({"form": "expression", "value": {"kind": "num", "value": 1e23}}) == 10 ** 23


def test_worked_example_includes_a_real_counterexample():
    response = verify_pair("2(x+3)=14", "2x+3=14")
    assert response["status"] == "not_equivalent"
    assert response["counterexample"] == {"symbol_values": {"x": 4}}


def test_task_fallback_and_previous_step_precedence():
    payload = {"topic": "linear_equation", "task_statement": parse_math_statement("2(x+3)=14"),
               "previous_step": None, "current_step": parse_math_statement("x=4")}
    assert verify_step(payload)["status"] == "equivalent"
    payload["previous_step"] = parse_math_statement("x=5")
    assert verify_step(payload)["status"] == "not_equivalent"


def test_mixed_forms_rejected():
    assert verify_pair("x+1", "x=1")["status"] == "invalid"


def test_large_python_integer_literals_remain_exact():
    assert verify_pair("9007199254740993", "9007199254740992")["status"] == "not_equivalent"


def test_unsupported_multivariate_math_does_not_guess_equivalence():
    response = verify_pair("x^2+y^2=-1", "x^2+y^2=-2")
    assert response["status"] == "ambiguous_domain"
