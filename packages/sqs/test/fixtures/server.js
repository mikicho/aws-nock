import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'

const QueueUrl = 'http://localhost:12345/test-queue'
const client = new SQSClient({
  region: 'eu-west-1',
  endpoint: QueueUrl,
})

/**
 * @param {{ name: string }} user
 */
export async function createUser(user) {
  await client.send(
    new SendMessageCommand({
      QueueUrl,
      MessageBody: JSON.stringify(user),
    }),
  )

  return { status: 200 }
}

export default {
  createUser,
}
