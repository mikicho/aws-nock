import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs'

const QueueUrl = 'http://localhost:12345/test-queue'
const client = new SQSClient({
  region: 'eu-west-1',
  endpoint: QueueUrl,
})

let isRunning = false

export function startConsumer() {
  isRunning = true

  async function poll() {
    const response = await client.send(new ReceiveMessageCommand({ QueueUrl }))
    if (response.Messages) {
      const { Body, ReceiptHandle } = response.Messages[0]
      const { name, payload } = JSON.parse(/**@type {string} */ (Body))
      await handlers[name](payload, ReceiptHandle)
    }

    if (isRunning) {
      setTimeout(poll, 0)
    }
  }
  poll()
}

export function stopConsumer() {
  isRunning = false
}

const handlers = {
  [sendAnotherMessage.name]: sendAnotherMessage,
  [sendTwoMessages.name]: sendTwoMessages,
  [malformedMessage.name]: malformedMessage,
}

/**
 * @param {object} payload
 * @param {string} [receiptHandle]
 */
async function sendAnotherMessage(payload, receiptHandle) {
  await client.send(
    new SendMessageCommand({
      QueueUrl,
      MessageBody: JSON.stringify(payload),
    }),
  )
  await client.send(
    new DeleteMessageCommand({ QueueUrl, ReceiptHandle: receiptHandle }),
  )
}

/**
 * @param {{payload1: object, payload2: object}} payload
 * @param {string} [receiptHandle]
 */
async function sendTwoMessages(payload, receiptHandle) {
  await client.send(
    new SendMessageCommand({
      QueueUrl,
      MessageBody: JSON.stringify(payload.payload1),
    }),
  )
  await client.send(
    new SendMessageCommand({
      QueueUrl,
      MessageBody: JSON.stringify(payload.payload2),
    }),
  )
  await client.send(
    new DeleteMessageCommand({ QueueUrl, ReceiptHandle: receiptHandle }),
  )
}

/**
 * @param {object} payload
 * @param {string} [receiptHandle]
 */
async function malformedMessage(payload, receiptHandle) {
  try {
    throw new Error()
  } catch {
    await client.send(
      new ChangeMessageVisibilityCommand({
        QueueUrl,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: 1000,
      }),
    )
  }
}
