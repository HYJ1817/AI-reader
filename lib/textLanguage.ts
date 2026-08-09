const HAN_CHARACTER = /\p{Script=Han}/u;

export function getTxtParagraphLanguage(
  text: string
): "zh-CN" | undefined {
  return HAN_CHARACTER.test(text) ? "zh-CN" : undefined;
}
