using Avalonia;
using Avalonia.Markup.Xaml;

namespace NodeNET.RuntimeFixture;

public partial class HeadlessApp : Application
{
    public override void Initialize() => AvaloniaXamlLoader.Load(this);
}
