import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // Allows React app to connect
  },
})
export class TicketsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  // Broadcast when a new ticket is created
  emitTicketCreated(ticket: any) {
    this.server.emit('ticketCreated', ticket);
  }

  // Broadcast when a ticket is updated
  emitTicketUpdated(ticket: any) {
    this.server.emit('ticketUpdated', ticket);
  }
}