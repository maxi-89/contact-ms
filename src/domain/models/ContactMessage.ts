export interface ContactMessageData {
  name: string;
  lastname: string;
  email: string;
  phone: string;
  message: string;
}

export class ContactMessage {
  readonly id: string;
  readonly name: string;
  readonly lastname: string;
  readonly email: string;
  readonly phone: string;
  readonly message: string;
  readonly timestamp: number;

  constructor(id: string, data: ContactMessageData) {
    this.id = id;
    this.name = data.name;
    this.lastname = data.lastname;
    this.email = data.email;
    this.phone = data.phone;
    this.message = data.message;
    this.timestamp = Date.now();
  }

  toQueuePayload(): Record<string, unknown> {
    return {
      type: 'contact_message',
      data: {
        id: this.id,
        name: this.name,
        lastname: this.lastname,
        email: this.email,
        phone: this.phone,
        message: this.message,
        timestamp: this.timestamp,
      },
    };
  }
}
