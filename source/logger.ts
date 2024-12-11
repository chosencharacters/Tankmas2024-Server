import { format } from 'jsr:@std/datetime/format';

declare global {
  // deno-lint-ignore no-var
  var logger: Logger;
}

class Logger {
  info(text: string | unknown) {
    const now = format(new Date(), 'HH:mm:ss');
    console.info(`[${now}]`, text);
  }

  warn(text: string | unknown) {
    const now = format(new Date(), 'HH:mm:ss');
    console.warn(`[${now}]`, text);
  }

  error(text: string | unknown) {
    const now = format(new Date(), 'HH:mm:ss');
    console.error(`[${now}]`, text);
  }
}

globalThis.logger = new Logger();
