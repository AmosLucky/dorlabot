import AutomationsListClient from '@/components/automations/AutomationsListClient'

export default function CommentAutomationsPage() {
  return (
    <AutomationsListClient
      types={['COMMENT_REPLY']}
      title="Comment Automations"
      description="Reply privately to eligible Facebook comments — one reply per comment, inside the Meta policy window."
      empty={{
        icon: 'bi-chat-square-quote',
        title: 'No comment automations yet',
        text: 'Create an automation to turn comments on your eligible posts into private Messenger conversations. Choose any comment or keyword triggers, pick target posts, and personalize the reply.',
      }}
    />
  )
}
