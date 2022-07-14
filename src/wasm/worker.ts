const ctx: Worker = self as any; // eslint-disable-line no-restricted-globals

interface InitArgs {}

ctx.addEventListener("message", (event: MessageEvent<InitArgs>) => {});

export {};
