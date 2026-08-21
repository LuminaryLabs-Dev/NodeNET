# NodeNET interoperability

NodeNET's default CLR bridge is process-isolated and reflection-based.

## Compatibility API

```js
const lib = await net.library('./Library.dll');
const response = await lib.invoke({
  type: 'Example.Calculator',
  method: 'Add',
  arguments: [5, 8]
});
```

## Persistent objects

```js
const Counter = lib.type('Example.Counter');
const counter = await Counter.new(10);
await counter.call('Increment');
const value = await counter.get('Value');
await counter.set('Value', 20);
await counter.dispose();
```

Constructed CLR objects remain inside the bridge and are represented in JavaScript by opaque handles. This avoids pretending that arbitrary CLR objects are plain JavaScript objects and gives resource lifetime an explicit boundary.

## Binary and streams

`Buffer`/`Uint8Array` arguments use the raw protocol payload instead of base64 JSON when a target parameter is `byte[]`, `Memory<byte>`, or `ReadOnlyMemory<byte>`. `System.IO.Stream` results become remote stream handles with chunked `read()` and `write()` operations.

## Current scope

The 0.3 bridge establishes the object, descriptor, binary, and stream foundations. Event subscriptions, delegate callbacks, cancellation-token bridging, and richer generic/ref/out semantics remain future protocol operations; they do not require changing the transport or object-handle model.
