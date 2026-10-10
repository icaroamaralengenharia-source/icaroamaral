import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "desktop-1366x768", width: 1366, height: 768 },
  { name: "mobile-412x915", width: 412, height: 915 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "mobile-360x800", width: 360, height: 800 }
];

for (const viewport of viewports) {
  test(`ELO chat bubbles remain readable at ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/tests/fixtures/elo-chat-bubbles.html");

    const metrics = await page.locator(".elo-message").evaluateAll((messages) => {
      return messages.map((message) => {
        const bubble = message.querySelector(".elo-message-bubble");
        const rect = bubble.getBoundingClientRect();
        const messageRect = message.getBoundingClientRect();
        const style = getComputedStyle(bubble);
        const actions = message.querySelector(".elo-speech-actions");
        const actionsRect = actions ? actions.getBoundingClientRect() : null;

        return {
          name: message.dataset.case,
          role: message.classList.contains("user") ? "user" : "assistant",
          messageTop: messageRect.top,
          messageBottom: messageRect.bottom,
          messageHeight: messageRect.height,
          messageScrollHeight: message.scrollHeight,
          flexShrink: getComputedStyle(message).flexShrink,
          bubbleTop: rect.top,
          bubbleRight: rect.right,
          bubbleBottom: rect.bottom,
          bubbleHeight: rect.height,
          bubbleClientHeight: bubble.clientHeight,
          bubbleScrollHeight: bubble.scrollHeight,
          bubbleClientWidth: bubble.clientWidth,
          bubbleScrollWidth: bubble.scrollWidth,
          minHeight: style.minHeight,
          lineHeight: style.lineHeight,
          whiteSpace: style.whiteSpace,
          overflowWrap: style.overflowWrap,
          actionsLeft: actionsRect ? actionsRect.left : null,
          actionsTop: actionsRect ? actionsRect.top : null,
          actionsVisible: actions ? actions.getBoundingClientRect().height > 0 : false
        };
      });
    });

    expect(metrics).toHaveLength(9);
    for (const item of metrics) {
      expect(item.flexShrink, `${item.name} must not shrink in the scroll column`).toBe("0");
      expect(item.messageHeight, `${item.name} article must contain its bubble`).toBeGreaterThanOrEqual(item.bubbleHeight - 1);
      expect(item.bubbleScrollHeight, `${item.name} text must not be clipped vertically`).toBeLessThanOrEqual(item.bubbleClientHeight + 1);
      expect(item.bubbleScrollWidth, `${item.name} text must wrap inside the bubble`).toBeLessThanOrEqual(item.bubbleClientWidth + 1);
      expect(item.minHeight, `${item.name} must retain one text line`).not.toBe("0px");
    }

    const byName = Object.fromEntries(metrics.map((item) => [item.name, item]));
    expect(byName.long.bubbleHeight).toBeGreaterThan(byName.short.bubbleHeight);
    expect(byName["two-lines"].bubbleHeight).toBeGreaterThan(byName.short.bubbleHeight);
    expect(byName.uuid.bubbleScrollWidth).toBeLessThanOrEqual(byName.uuid.bubbleClientWidth + 1);
    expect(byName.unbroken.bubbleScrollWidth).toBeLessThanOrEqual(byName.unbroken.bubbleClientWidth + 1);
    expect(byName["multi-paragraph"].bubbleHeight).toBeGreaterThan(byName.short.bubbleHeight);
    expect(byName["listen-button"].actionsVisible).toBe(true);
    expect(byName["tts-active"].actionsVisible).toBe(true);
    for (const name of ["listen-button", "tts-active"]) {
      if (viewport.name.startsWith("mobile")) {
        // Mobile presents speech controls in a separate rail to the right of the bubble.
        expect(byName[name].actionsLeft).toBeGreaterThanOrEqual(byName[name].bubbleRight - 1);
        expect(byName[name].actionsTop).toBeGreaterThanOrEqual(byName[name].bubbleTop - 3);
        expect(byName[name].actionsTop).toBeLessThanOrEqual(byName[name].bubbleTop + 3);
      } else {
        // Desktop presents speech controls below the bubble.
        expect(byName[name].actionsTop).toBeGreaterThanOrEqual(byName[name].bubbleBottom - 3);
      }
    }

    const orderedMessages = metrics.toSorted((left, right) => left.messageTop - right.messageTop);
    for (let index = 1; index < orderedMessages.length; index += 1) {
      expect(orderedMessages[index].messageTop, `${orderedMessages[index - 1].name} must not overlap ${orderedMessages[index].name}`)
        .toBeGreaterThanOrEqual(orderedMessages[index - 1].messageBottom - 1);
    }

    const userAlignment = await page.locator('[data-case="long"] .elo-message-bubble').evaluate((bubble) => {
      const bubbleRect = bubble.getBoundingClientRect();
      const messageRect = bubble.parentElement.getBoundingClientRect();
      return Math.abs(messageRect.right - bubbleRect.right);
    });
    expect(userAlignment).toBeLessThanOrEqual(2);

    const messages = page.locator(".elo-messages");
    const scrollMetrics = await messages.evaluate((element) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight
    }));
    const positions = [0, Math.round((scrollMetrics.scrollHeight - scrollMetrics.clientHeight) / 2), scrollMetrics.scrollHeight];
    for (const [index, position] of positions.entries()) {
      await messages.evaluate((element, top) => { element.scrollTop = top; }, position);
      await expect(page.locator(".elo-message-bubble").first()).toBeVisible();
      await testInfo.attach(`${viewport.name}-scroll-${index + 1}`, {
        body: await page.screenshot({ fullPage: false }),
        contentType: "image/png"
      });
    }
  });
}
