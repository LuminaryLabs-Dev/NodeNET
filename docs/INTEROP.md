# NodeNET interoperability

NodeNET's default CLR bridge is process-isolated and reflection-based.

## Compatibility API

```js
const response = await lib.invoke({
  type: 'Example.Calculator',
  method: 'Add',
  arguments: [5, 8]
});
```

An explicit deterministic CLR signature may be supplied:

```js
await lib.invoke({
  type: 'Example.Calculator',
  member: 'Add',
  signature: 'Add(System.Int32,System.Int32)',
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

Object and static calls also accept descriptor form when overload selection must be explicit:

```js
await counter.call({
  member: 'Set',
  signature: 'Set(System.Int32)',
  arguments: [20]
});
```

Constructors can be selected explicitly with `RemoteType.construct({ signature, arguments })`.

## Binary and streams

`Buffer`/`Uint8Array` arguments use the raw protocol payload for `byte[]`, `Memory<byte>`, or `ReadOnlyMemory<byte>`. `System.IO.Stream` results become pull-based remote stream handles, which naturally apply backpressure because Node requests each chunk.

## Scope

The object/descriptor/binary/stream foundation is stable enough for Developer Preview use. Delegate callbacks, CLR event subscriptions, CancellationToken/AbortSignal bridging, richer generic/ref/out semantics, and explicit protocol feature negotiation remain later interop work; they should extend the current model rather than replace it.
