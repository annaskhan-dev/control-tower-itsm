import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // Adjust or restrict in production to trusted frontends
    credentials: true,
  },
})
export class TicketsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TicketsGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
    
    // Optional: Extract companyId from handshake query if clients pass it on connect
    const companyId = client.handshake.query.companyId;
    if (companyId && typeof companyId === 'string') {
      client.join(`company_${companyId}`);
      this.logger.debug(`Client ${client.id} automatically joined room: company_${companyId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Allows clients to explicitly join a company or tenant room for scoped broadcasting
   */
  @SubscribeMessage('joinCompanyRoom')
  handleJoinCompanyRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { companyId: string },
  ) {
    if (data && data.companyId) {
      const roomName = `company_${data.companyId}`;
      client.join(roomName);
      this.logger.debug(`Socket ${client.id} joined scoped room: ${roomName}`);
      return { status: 'success', room: roomName };
    }
    return { status: 'error', message: 'Missing companyId' };
  }

  /**
   * Broadcast when a new ticket is created, scoped optionally by companyId
   */
  emitTicketCreated(ticket: any, companyId?: string) {
    const payload = { event: 'ticketCreated', data: ticket };
    if (companyId) {
      this.server.to(`company_${companyId}`).emit('ticketCreated', ticket);
      this.logger.debug(`Emitted 'ticketCreated' to room company_${companyId}`);
    } else {
      this.server.emit('ticketCreated', ticket);
      this.logger.debug(`Emitted 'ticketCreated globally'`);
    }
  }

  /**
   * Broadcast when a ticket is updated (status, assignment, timeline changes)
   */
  emitTicketUpdated(ticket: any, companyId?: string) {
    if (companyId) {
      this.server.to(`company_${companyId}`).emit('ticketUpdated', ticket);
      this.logger.debug(`Emitted 'ticketUpdated' to room company_${companyId}`);
    } else {
      this.server.emit('ticketUpdated', ticket);
      this.logger.debug(`Emitted 'ticketUpdated globally'`);
    }
  }

  /**
   * Broadcast when a ticket is removed/deleted
   */
  emitTicketDeleted(ticketId: string, companyId?: string) {
    const payload = { ticketId };
    if (companyId) {
      this.server.to(`company_${companyId}`).emit('ticketDeleted', payload);
      this.logger.debug(`Emitted 'ticketDeleted' for ID ${ticketId} to company_${companyId}`);
    } else {
      this.server.emit('ticketDeleted', payload);
      this.logger.debug(`Emitted 'ticketDeleted globally' for ID ${ticketId}`);
    }
  }
}