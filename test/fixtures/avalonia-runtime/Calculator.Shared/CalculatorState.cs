using System.Globalization;

namespace NodeNET.RuntimeFixture;

public sealed class CalculatorState
{
    private decimal? _left;
    private string? _operator;
    private bool _replace = true;

    public string Display { get; private set; } = "0";
    public string Expression { get; private set; } = "READY";
    public int InputCount { get; private set; }

    public void Press(string token)
    {
        ArgumentException.ThrowIfNullOrEmpty(token);
        InputCount++;

        if (token.Length == 1 && char.IsDigit(token[0]))
        {
            Display = _replace || Display == "0" ? token : Display + token;
            _replace = false;
            return;
        }

        if (token == ".")
        {
            if (_replace) Display = "0";
            if (!Display.Contains('.')) Display += ".";
            _replace = false;
            return;
        }

        if (token == "C")
        {
            Display = "0";
            Expression = "READY";
            _left = null;
            _operator = null;
            _replace = true;
            return;
        }

        if (token is "+" or "-" or "/")
        {
            _left = decimal.Parse(Display, CultureInfo.InvariantCulture);
            _operator = token;
            Expression = $"{Display} {token}";
            _replace = true;
            return;
        }

        if (token != "=" || _left is null || _operator is null) return;

        var right = decimal.Parse(Display, CultureInfo.InvariantCulture);
        var result = _operator switch
        {
            "+" => _left.Value + right,
            "-" => _left.Value - right,
            "/" when right != 0 => _left.Value / right,
            "/" => throw new DivideByZeroException(),
            _ => throw new InvalidOperationException($"Unsupported operator: {_operator}")
        };

        Expression = $"{_left.Value.ToString(CultureInfo.InvariantCulture)} {_operator} {right.ToString(CultureInfo.InvariantCulture)} =";
        Display = result.ToString("0.##########", CultureInfo.InvariantCulture);
        _left = null;
        _operator = null;
        _replace = true;
    }
}
