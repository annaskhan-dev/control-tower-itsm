import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    this.logger.log('[EmailService] Worker completely disabled for debugging.');
  }
}