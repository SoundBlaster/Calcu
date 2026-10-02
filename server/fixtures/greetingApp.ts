// A native application: no ASP, transport, receipt or Calcu dependency.
export type Greeting = {
  recipients: string[];
  style: { prefix: 'Hello' | 'Welcome'; punctuation: '!' | '.' };
};

export type Greetings = { messages: string[] };

export class GreetingApp {
  greet(input: Greeting): Greetings {
    return {
      messages: input.recipients.map(
        (name) => `${input.style.prefix}, ${name}${input.style.punctuation}`,
      ),
    };
  }
}
