const args = process.argv.slice(2);
const command = args[0];

if (command === '--info') {
  console.log('.NET SDK:\n Version:           10.0.100\n Workload version:  10.0.100-manifests.1');
  process.exit(0);
}
if (command === '--list-sdks') {
  console.log('8.0.412 [/fake/sdk]');
  console.log('10.0.100 [/fake/sdk]');
  process.exit(0);
}
if (command === '--list-runtimes') {
  console.log('Microsoft.NETCore.App 8.0.19 [/fake/shared/Microsoft.NETCore.App]');
  console.log('Microsoft.NETCore.App 10.0.0 [/fake/shared/Microsoft.NETCore.App]');
  process.exit(0);
}
if (command === '--version') {
  console.log('10.0.100');
  process.exit(0);
}
if (command === 'workload' && args[1] === 'list') {
  console.log('Installed Workload Id      Manifest Version');
  console.log('------------------------------------------------');
  process.exit(0);
}
if (['restore', 'build', 'test', 'publish', 'clean'].includes(command)) {
  if (process.env.NODENET_FAKE_FAIL === command) {
    console.error(`/tmp/Fake.cs(4,2): error CS1002: ; expected [Fake.csproj]`);
    process.exit(1);
  }
  console.log(`fake ${command} ok`);
  process.exit(0);
}
if (command === 'run') {
  console.log('fake run ok');
  process.exit(0);
}
if (command?.endsWith('.dll')) {
  console.log('fake assembly ok');
  process.exit(0);
}

console.log(JSON.stringify({ args, dotnetRoot: process.env.DOTNET_ROOT ?? null }));
