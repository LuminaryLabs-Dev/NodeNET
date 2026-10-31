using Avalonia.Controls;

namespace NodeNET.RuntimeFixture;

public sealed class CalculatorWindow : Window
{
    public CalculatorWindow()
    {
        Title = "NodeNET Display Validator";
        Width = 420;
        Height = 640;
        MinWidth = 360;
        MinHeight = 560;
        Calculator = new CalculatorView();
        Content = Calculator;
    }

    public CalculatorView Calculator { get; }
    public CalculatorState State => Calculator.State;
    public string DisplayText => Calculator.DisplayText;
    public string ExpressionText => Calculator.ExpressionText;
}
