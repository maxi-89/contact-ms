export interface ProjectRequestData {
  name: string;
  email: string;
  projectType: string;
  description: string;
  budget?: string;
}

export class ProjectRequest {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly projectType: string;
  readonly description: string;
  readonly budget: string | undefined;
  readonly timestamp: number;

  constructor(id: string, data: ProjectRequestData) {
    this.id = id;
    this.name = data.name;
    this.email = data.email;
    this.projectType = data.projectType;
    this.description = data.description;
    this.budget = data.budget;
    this.timestamp = Date.now();
  }

  toQueuePayload(): Record<string, unknown> {
    return {
      type: 'project_request',
      data: {
        id: this.id,
        name: this.name,
        email: this.email,
        projectType: this.projectType,
        description: this.description,
        budget: this.budget,
        timestamp: this.timestamp,
      },
    };
  }
}
