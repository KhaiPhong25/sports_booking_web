import { randomUUID } from "node:crypto";
import { NodemailerEmailAdapter } from "./email.adapter";

const runMailHogTests =
  process.env.TEST_MAILHOG === "true" ? describe : describe.skip;

interface MailHogMessage {
  Content?: {
    Headers?: { From?: string[]; Subject?: string[]; To?: string[] };
    Body?: string;
  };
}

runMailHogTests("NodemailerEmailAdapter with MailHog", () => {
  it("delivers a real SMTP message that is visible through MailHog API", async () => {
    const suffix = randomUUID();
    const recipient = `phase7-${suffix}@example.com`;
    const subject = `Phase 7 ${suffix}`;
    const text = `MailHog integration ${suffix}`;
    const adapter = NodemailerEmailAdapter.fromEnvironment();

    await adapter.send({ to: recipient, subject, text });

    let matched: MailHogMessage | undefined;
    for (let attempt = 0; attempt < 10 && !matched; attempt += 1) {
      const response = await fetch(
        `${process.env.MAILHOG_API_URL ?? "http://127.0.0.1:8025"}/api/v2/messages`,
      );
      expect(response.ok).toBe(true);
      const result = (await response.json()) as { items: MailHogMessage[] };
      matched = result.items.find(
        (message) => message.Content?.Headers?.Subject?.[0] === subject,
      );
      if (!matched) await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(matched?.Content?.Headers?.From).toContain(
      "Sports Center <no-reply@sports.local>",
    );
    expect(matched?.Content?.Headers?.To).toContain(recipient);
    expect(matched?.Content?.Body).toContain(text);
  });
});
