import { GuideChat } from '@/components/admin/GuideChat';
import { guideChatIsLive } from '@/lib/ai/guide-chat';

export const metadata = { title: 'Assistant · Admin' };

export default function AssistantPage() {
  const live = guideChatIsLive();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Assistant</h1>
        <p className="mt-1 text-sm text-gray-400">
          Ask anything about how the app works. Answers are grounded in your user guides.
          {!live && (
            <span className="ml-1 text-amber-400">
              Demo mode — set <code>GEMINI_API_KEY</code> to enable live answers.
            </span>
          )}
        </p>
      </div>
      <GuideChat variant="page" />
    </div>
  );
}
