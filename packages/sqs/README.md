# AWS Nock

Fast AWS testing with nock

## Why

- You test everything you run in production.
- Spy only, no mocking. Which helps you write well-bounded [integration tests](https://github.com/testjavascript/nodejs-integration-tests-best-practices).
- A faster and in-process [LocalStack](https://github.com/localstack/localstack) alternative for Node.js.

## SQS

### API

#### initSqsNock

Initialize a fake queue, that returns empty response for ReceiveMessage requests:

```js
beforeAll(() => {
  const queueUrl = 'http://localhost:12345/test-queue'
  initSqsNock(queueUrl)
})
```

#### pushMessageAndWait

Sends a message to the queue and retrieves any new messages if the handler is successful. It will throw an error in case of failure.

#### waitForNewMessage

Retrieves the body of a newly queued message.

### Examples

#### Test push message to a queue

```js
it('should send an API request and wait for a message', async () => {
  const user = { name: randomUUID() }

  server.createUser(user)
  const message = await waitForNewMessage()

  expect(message).toStrictEqual(user)
})
```

#### Test a handler that submit another message

```js
it('should invoke a handler, wait for a message, and its deletion from the queue', async () => {
  const payload = { a: randomUUID() }

  const [message] = await pushMessageAndWait({
    name: 'sendAnotherMessage',
    payload,
  })

  expect(message).toStrictEqual(payload)
})
```
