import { after, before, describe, it } from 'node:test'
import { jestExpect as expect } from '@jest/expect'
import {
  SQSClient,
  ReceiveMessageCommand,
  SendMessageCommand,
} from '@aws-sdk/client-sqs'
import { initSqsNock, pushMessageAndWait, waitForNewMessage } from '../index.js'
import { randomUUID } from 'node:crypto'
import { startConsumer, stopConsumer } from './fixtures/consumer.js'
import server from './fixtures/server.js'

const QueueUrl = 'http://localhost:12345/test-queue'
const client = new SQSClient({
  region: 'eu-west-1',
  endpoint: QueueUrl,
})

describe('SQS', () => {
  before(() => {
    initSqsNock(QueueUrl)
  })

  describe('initSqsNock', () => {
    it('should return empty response for receive message requests', async () => {
      const response = await client.send(
        new ReceiveMessageCommand({ QueueUrl }),
      )

      expect(response).toStrictEqual({
        $metadata: expect.objectContaining({
          httpStatusCode: 200,
        }),
      })
    })
  })

  it('should get messages in FIFO order', async () => {
    client.send(
      new SendMessageCommand({
        QueueUrl,
        MessageBody: JSON.stringify({ body: 'test message' }),
      }),
    )
    client.send(
      new SendMessageCommand({
        QueueUrl,
        MessageBody: JSON.stringify({ body: 'second message' }),
      }),
    )
    const [first, second] = await Promise.all([
      waitForNewMessage(),
      waitForNewMessage(),
    ])

    expect({ first, second }).toStrictEqual({
      first: { body: 'test message' },
      second: { body: 'second message' },
    })
  })

  describe('Sync', () => {
    it('should send an API request and wait for a message', async () => {
      const user = { name: randomUUID() }

      server.createUser(user)
      const message = await waitForNewMessage()

      expect(message).toStrictEqual(user)
    })
  })

  describe('Async', () => {
    before(() => {
      startConsumer()
    })

    after(() => {
      stopConsumer()
    })

    it('should invoke a handler, wait for a message, and its deletion from the queue', async () => {
      const payload = { a: randomUUID() }

      const [message] = await pushMessageAndWait({
        name: 'sendAnotherMessage',
        payload,
      })

      expect(message).toStrictEqual(payload)
    })

    it('should intercept two consecutive pushMessageAndWait', async () => {
      const payload = { a: randomUUID() }

      const [message] = await pushMessageAndWait({
        name: 'sendAnotherMessage',
        payload,
      })
      const [message1] = await pushMessageAndWait({
        name: 'sendAnotherMessage',
        payload,
      })

      expect(message).toStrictEqual(payload)
      expect(message1).toStrictEqual(payload)
    })

    it('should assert two SendMessage requests', async () => {
      const payload1 = { a: randomUUID() }
      const payload2 = { b: randomUUID() }

      const [message1, message2] = await pushMessageAndWait({
        name: 'sendTwoMessages',
        payload: { payload1, payload2 },
      })

      expect({ payload1: message1, payload2: message2 }).toStrictEqual({
        payload1,
        payload2,
      })
    })

    it('should invoke a handler, and wait for any message to fail', async () => {
      await expect(
        pushMessageAndWait({ name: 'malformedMessage' }),
      ).rejects.toThrowError()
    })

    it('should invoke a handler, and wait for a message to fail', async () => {
      await expect(
        pushMessageAndWait({ name: 'malformedMessage' }),
      ).rejects.toThrowError()
    })
  })
})
