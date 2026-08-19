import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { metaChallenge, parseMetaMessaging, verifyMetaSignature } from "./meta";

describe("meta inbox helpers", () => {
  it("parses Messenger-style messaging events", () => {
    const messages = parseMetaMessaging({
      entry: [
        {
          id: "PAGE123",
          messaging: [
            {
              sender: { id: "USER456" },
              recipient: { id: "PAGE123" },
              message: { mid: "m.1", text: "Hello" },
            },
          ],
        },
      ],
    });

    expect(messages).toEqual([
      {
        accountId: "PAGE123",
        threadId: "USER456",
        externalId: "m.1",
        body: "Hello",
        contactName: "USER456",
        contactHandle: "",
      },
    ]);
  });

  it("ignores events without text", () => {
    expect(
      parseMetaMessaging({
        entry: [{ id: "P", messaging: [{ sender: { id: "U" }, message: { mid: "m.2" } }] }],
      }),
    ).toEqual([]);
  });

  it("verifies sha256 signatures", () => {
    const secret = "app-secret";
    const body = '{"object":"page"}';
    const digest = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyMetaSignature(secret, body, `sha256=${digest}`)).toBe(true);
    expect(verifyMetaSignature(secret, body, "sha256=deadbeef")).toBe(false);
  });

  it("returns hub.challenge when verify token matches", () => {
    const url = "https://panel.test/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHAL";
    const challenge = metaChallenge(new Request(url), "TOKEN");
    expect(challenge).toBe("CHAL");
    expect(metaChallenge(new Request(url), "WRONG")).toBeNull();
  });
});
