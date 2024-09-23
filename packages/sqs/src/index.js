import nock from 'nock'
import { createHash, randomUUID } from 'node:crypto'

/** @type {URL} */
let _queueUrl

/**
 * @param {string | URL} queueUrl
 */
export function initSqsNock(queueUrl) {
  _queueUrl = new URL(queueUrl)
  _queueUrl.pathname = _queueUrl.pathname.endsWith('/')
    ? _queueUrl.pathname
    : _queueUrl.pathname + '/'

  // We can't use persist because it stuck in the same position in the queue forever
  nock(_queueUrl.origin)
    .matchHeader('x-amz-target', 'AmazonSQS.ReceiveMessage')
    .post(_queueUrl.pathname)
    .reply(200, () => {
      initSqsNock(_queueUrl)
      return sqsReceivedMessageResponseFactory([])
    })
}

/**
 * @param {object} message
 */
export function pushMessageAndWait(message) {
  const receiptHandle = sendMessage(message)
  return new Promise((resolve, reject) => {
    /** @type {object[]} */
    const messages = []
    const controller = new AbortController()

    function waitForMessages() {
      waitForNewMessage(controller.signal).then((message) => {
        messages.push(message)
        return waitForMessages()
      })
    }

    waitForMessages()
    waitForVisibilityChanged(receiptHandle).then(
      () => (controller.abort(), reject(new Error('message failed'))),
    )
    waitForMessageDeleted(receiptHandle).then(
      () => (controller.abort(), resolve(messages)),
    )
  })
}

/**
 * @param {object} message
 * @param {string} receiptHandle
 */
function sendMessage(message, receiptHandle = randomUUID()) {
  nock(_queueUrl.origin)
    .post(_queueUrl.pathname)
    .reply(
      200,
      sqsReceivedMessageResponseFactory([
        { body: JSON.stringify(message), receiptHandle },
      ]),
    )

  return receiptHandle
}

/**
 * @param {AbortSignal} [signal]
 */
export function waitForNewMessage(signal) {
  return new Promise((resolve) => {
    const interceptor = nock(_queueUrl.origin)
      .matchHeader('x-amz-target', 'AmazonSQS.SendMessage')
      .post(_queueUrl.pathname)

    interceptor.reply(200, (uri, body) => {
      const messageBody = JSON.parse(/** @type {string} */ (body)).MessageBody

      resolve(JSON.parse(messageBody))
      return sqsSendMessageResponseFactory(messageBody)
    })

    signal?.addEventListener('abort', () => nock.removeInterceptor(interceptor))
  })
}

/**
 * @param {string | undefined} [receiptHandle]
 * @returns {Promise<import('nock').Body>}
 */
function waitForMessageDeleted(receiptHandle) {
  return new Promise((resolve) => {
    nock(_queueUrl.origin)
      .matchHeader('x-amz-target', 'AmazonSQS.DeleteMessage')
      .post(_queueUrl.pathname, (body) => {
        return !receiptHandle || body.ReceiptHandle === receiptHandle
      })
      .reply(200, (uri, body) => {
        resolve(body)
      })
  })
}

/**
 * @param {string | undefined} [receiptHandle]
 * @returns {Promise<import('nock').Body>}
 */
function waitForVisibilityChanged(receiptHandle) {
  return new Promise((resolve) => {
    nock(_queueUrl.origin)
      .matchHeader('x-amz-target', 'AmazonSQS.ChangeMessageVisibility')
      .post(_queueUrl.pathname, (body) => {
        return !receiptHandle || body.ReceiptHandle === receiptHandle
      })
      .reply(200, (uri, body) => {
        // @ts-expect-error type mismatch, probably Nock's problem
        resolve(body.ReceiptHandle)
      })
  })
}

/**
 * @param {Array<{ body: string, receiptHandle: string }>} messages
 */
function sqsReceivedMessageResponseFactory(messages) {
  // if not messages, SQS returns empty object
  if (messages.length === 0) {
    return {}
  }

  return {
    Messages: messages.map(({ body, receiptHandle }) => ({
      Attributes: {
        SenderId: 'AIDASSYFHUBOBT7F4XT75',
        ApproximateFirstReceiveTimestamp: '1677112433437',
        ApproximateReceiveCount: '1',
        SentTimestamp: '1677112427387',
      },
      Body: body,
      MD5OfBody: createHash('md5').update(body).digest('hex'),
      MessageId: '219f8380-5770-4cc2-8c3e-5c715e145f5e',
      ReceiptHandle: receiptHandle,
    })),
  }
}

/**
 * @param {string} body
 */
function sqsSendMessageResponseFactory(body) {
  return {
    MD5OfMessageAttributes: 'c48838208d2b4e14e3ca0093a8443f09',
    MD5OfMessageBody: createHash('md5').update(body).digest('hex'),
    MessageId: '219f8380-5770-4cc2-8c3e-5c715e145f5e',
  }
}
