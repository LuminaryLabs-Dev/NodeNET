using Avalonia.Controls;
using Avalonia.Interactivity;

namespace NodeNET.RuntimeFixture;

public partial class CalculatorWindow : Window
{
    public CalculatorWindow()
    {
        InitializeComponent();
        State = new CalculatorState();
        RenderState();
    }

    public CalculatorState State { get; }
    public string DisplayText => State.Display;
    public string ExpressionText => State.Expression;

    private void OnButton(object? sender, RoutedEventArgs eventArgs)
    {
        var token = (sender as Button)?.Content?.ToString();
        if (string.IsNullOrEmpty(token)) return;
        State.Press(token);
        RenderState();
    }

    private void RenderState()
    {
        (this.FindControl<TextBlock>("Display") ?? throw new InvalidOperationException("Display control is missing.")).Text = State.Display;
        (this.FindControl<TextBlock>("Expression") ?? throw new InvalidOperationException("Expression control is missing.")).Text = State.Expression;
    }
}
