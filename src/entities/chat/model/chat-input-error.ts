export class ChatInputError extends Error {
  constructor(
    public readonly field: "message" | "image" | "cursor" | "size",
    message: string,
  ) {
    super(message);
    this.name = "ChatInputError";
  }
}
