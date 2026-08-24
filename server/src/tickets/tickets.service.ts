import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ticket, TicketDocument } from './schemas/ticket.schema';
import { SlaConfig, SlaConfigDocument } from './schemas/sla-config.schema';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsGateway } from './tickets.gateway';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(SlaConfig.name) private slaConfigModel: Model<SlaConfigDocument>,
    @InjectModel('User') private userModel: Model<any>,
    private readonly ticketsGateway: TicketsGateway,
  ) {}

  private authorize(userRole: string, allowedRoles: string[]) {
    if (userRole === 'Super Admin') return;
    
    const normalizedUserRole = userRole.replace(/\s+/g, '_').toLowerCase();
    const isAllowed = allowedRoles.some(
      role => role.replace(/\s+/g, '_').toLowerCase() === normalizedUserRole
    );

    if (!isAllowed) {
      throw new ForbiddenException(`You do not have permission to perform this action.`);
    }
  }

  // FIXED: Strictly enforces sub-assignment priority over primary assignee when checking resolver credit
  private getEffectiveResolver(ticket: any, fallbackTicket?: any): string {
    const sub = ticket?.subAssignment || fallbackTicket?.subAssignment;
    if (sub && typeof sub === 'string' && sub !== 'Unassigned' && sub.trim() !== '' && sub !== 'null') {
      return sub.trim();
    }
    
    const assignee = ticket?.assignee || ticket?.assignedTo || fallbackTicket?.assignee || fallbackTicket?.assignedTo;
    if (assignee && typeof assignee === 'string' && assignee !== 'Unassigned' && assignee.trim() !== '' && assignee !== 'null') {
      return assignee.trim();
    }
    
    return 'Unassigned';
  }

  async create(
    createTicketDto: CreateTicketDto, 
    companyId: string, 
    userRole: string, 
    userName?: string, 
    userId?: string
  ): Promise<Ticket> {
    try {
      const category = createTicketDto.category || 'fleet-coordination';
      const slaConfig = await this.slaConfigModel.findOne({ category, companyId }).exec();
      const hoursAllowed = slaConfig ? slaConfig.hours : 24;
      const deadline = new Date(Date.now() + hoursAllowed * 60 * 60 * 1000);
      const isAssigned = createTicketDto.assignee && createTicketDto.assignee !== 'Unassigned';
      const isSubAssigned = createTicketDto.subAssignment && createTicketDto.subAssignment !== 'Unassigned' && createTicketDto.subAssignment !== '';

      const resolvedUserName = userName && userName !== 'User' ? userName : 'Ali';
      const ticketGenerator = createTicketDto.generator || `${resolvedUserName} (${userRole})`;

      const ticketData = {
        ...createTicketDto,
        issueType: createTicketDto.issueType,
        category,
        status: 'Open',
        assignee: isAssigned ? createTicketDto.assignee : 'Unassigned',
        subAssignment: isSubAssigned ? createTicketDto.subAssignment : null,
        ticketId: `INC-${Math.floor(10000 + Math.random() * 90000)}`,
        slaDeadline: deadline,
        assignedAt: isAssigned ? new Date() : null,
        subAssignmentAt: isSubAssigned ? new Date() : null,
        resolvedAt: null,
        companyId: companyId,
        generator: ticketGenerator,
        createdBy: userId || null,
      };

      const createdTicket = new this.ticketModel(ticketData);
      const savedTicket = await createdTicket.save();

      this.ticketsGateway.emitTicketCreated(savedTicket, companyId);
      return savedTicket;
    } catch (error: any) {
      this.logger.error(`Failed to create ticket: ${error.message}`);
      throw new InternalServerErrorException('Could not create ticket');
    }
  }

  async createSlaCategory(
    companyId: string, 
    category: string, 
    priority: string, 
    hours: number
  ): Promise<SlaConfig> {
    const newSla = new this.slaConfigModel({
      companyId,
      category, 
      priority,
      hours,
    });
    return await newSla.save();
  }

  async update(
    id: string, 
    updateTicketDto: UpdateTicketDto, 
    companyId: string, 
    userRole: string, 
    currentUserName?: string
  ): Promise<Ticket> {
    const normalizedRole = userRole.replace(/\s+/g, '_').toLowerCase();
    const restrictedUpdateRoles = ['operator', 'transporter', 'shipper_ops', 'sales_person'];

    if (restrictedUpdateRoles.includes(normalizedRole)) {
      if (updateTicketDto.category !== undefined) {
        throw new ForbiddenException('You are not allowed to update Category.');
      }
      
      if (updateTicketDto.assignee !== undefined) {
        if (normalizedRole === 'operator') {
          if (currentUserName && updateTicketDto.assignee !== currentUserName) {
            throw new ForbiddenException('Operators can only assign tickets to themselves.');
          }
        } else {
          throw new ForbiddenException('You are not allowed to update Assignee.');
        }
      }
    }

    const baseQuery = id.startsWith('INC-') ? { ticketId: id } : { _id: id };
    const existingTicket = await this.ticketModel.findOne({ ...baseQuery, companyId });
    if (!existingTicket) throw new NotFoundException(`Ticket with ID ${id} not found`);

    const currentStatus = (existingTicket.status || '').toLowerCase();
    const isAlreadyResolved = ['closed', 'resolved', 'completed', 'done'].includes(currentStatus);

    if (isAlreadyResolved) {
      const isChangingCategory = updateTicketDto.category !== undefined && updateTicketDto.category !== existingTicket.category;
      const isChangingSubAssignment = updateTicketDto.subAssignment !== undefined && updateTicketDto.subAssignment !== existingTicket.subAssignment;

      if (isChangingCategory || isChangingSubAssignment) {
        throw new BadRequestException('Cannot modify category or sub-assignment once a ticket is resolved or closed.');
      }
    }

    if (updateTicketDto.status !== undefined && existingTicket.subAssignment) {
      const isManagerOrAdmin = ['manager', 'super_admin', 'admin'].some(r => normalizedRole.includes(r));
      const isPrimaryAssignee = currentUserName && existingTicket.assignee && 
        existingTicket.assignee.toLowerCase() === currentUserName.toLowerCase();

      if (isPrimaryAssignee && !isManagerOrAdmin) {
        throw new ForbiddenException('Primary assignees cannot change the ticket status once a sub-assignee is assigned.');
      }
    }

    const updateData: any = { ...updateTicketDto };
    delete updateData.slaDeadline;

    if (updateData.assignee !== undefined) {
      const isActuallyAssigned = updateData.assignee !== 'Unassigned' && updateData.assignee !== '';
      if (isActuallyAssigned) {
        updateData.assignedAt = existingTicket.assignedAt || new Date();
      } else {
        updateData.assignedAt = null;
      }
    }

    if (updateData.subAssignment !== undefined) {
      const isActuallySubAssigned = updateData.subAssignment !== 'Unassigned' && updateData.subAssignment !== '' && updateData.subAssignment !== null;
      
      if (isActuallySubAssigned) {
        const isNewSubAssignment = updateData.subAssignment !== existingTicket.subAssignment;
        if (isNewSubAssignment || !existingTicket.subAssignmentAt) {
          updateData.subAssignmentAt = new Date();
        }
      } else {
        updateData.subAssignment = null;
        updateData.subAssignmentAt = null;
      }
    }

    let isNewResolved = false;
    if (updateData.status !== undefined && updateData.status !== existingTicket.status) {
      isNewResolved = ['closed', 'resolved', 'completed', 'done'].includes(updateData.status.toLowerCase());
      if (isNewResolved) {
        updateData.resolvedAt = new Date();
        
        // FIX: Ensure active subAssignment isn't accidentally overwritten with null if only status is patched
        if (!updateData.subAssignment && existingTicket.subAssignment) {
          updateData.subAssignment = existingTicket.subAssignment;
        }
      } else {
        updateData.resolvedAt = null;
      }
    }

    // FIX: If the user is resolving the ticket right now and subAssignment wasn't explicitly passed in updateTicketDto,
    // explicitly ensure subAssignment is preserved in updateData so findOneAndUpdate stores it accurately.
    if (isNewResolved && !isAlreadyResolved) {
      if (!updateData.subAssignment && existingTicket.subAssignment) {
        updateData.subAssignment = existingTicket.subAssignment;
      }
    }

    const updatedTicket = await this.ticketModel
      .findOneAndUpdate({ ...baseQuery, companyId }, updateData, { new: true, runValidators: true })
      .exec();

    if (!updatedTicket) {
      throw new NotFoundException(`Ticket with ID ${id} could not be updated`);
    }

    if (isNewResolved && !isAlreadyResolved) {
      // Pass the fully updatedTicket first so getEffectiveResolver checks updated subAssignment/assignee
      const targetUser = this.getEffectiveResolver(updatedTicket, existingTicket);

      if (targetUser && targetUser !== 'Unassigned') {
        try {
          await this.userModel.findOneAndUpdate(
            { 
              companyId, 
              $or: [
                { name: new RegExp(`^${targetUser}$`, 'i') }, 
                { email: new RegExp(`^${targetUser}$`, 'i') },
                { role: new RegExp(`^${targetUser}$`, 'i') }
              ] 
            },
            { $inc: { resolvedCount: 1, completedTickets: 1 } }
          );
        } catch (counterErr: any) {
          this.logger.warn(`Failed to increment user resolved metrics for ${targetUser}: ${counterErr.message}`);
        }
      }
    }

    this.ticketsGateway.emitTicketUpdated(updatedTicket, companyId);
    return updatedTicket;
  }

  async remove(id: string, companyId: string, userRole: string): Promise<Ticket> {
    this.authorize(userRole, ['Manager', 'Super Admin']);
    const baseQuery = id.startsWith('INC-') ? { ticketId: id } : { _id: id };
    const deletedTicket = await this.ticketModel.findOneAndDelete({ ...baseQuery, companyId }).exec();
    if (!deletedTicket) throw new NotFoundException(`Ticket not found`);
    this.ticketsGateway.emitTicketDeleted(id, companyId);
    return deletedTicket;
  }

  async updateSla(id: string, hours: number, companyId: string, userRole: string): Promise<SlaConfig> {
    this.authorize(userRole, ['Manager', 'Super Admin']);
    const updatedSla = await this.slaConfigModel.findOneAndUpdate({ _id: id, companyId }, { hours }, { new: true }).exec();
    if (!updatedSla) throw new NotFoundException(`SLA config not found`);
    return updatedSla;
  }

  async findAll(search: string | undefined, queue: string | undefined, companyId: string, userRole: string, userName: string): Promise<Ticket[]> {
    const query: any = { companyId };
    const normalizedRole = (userRole || '').replace(/\s+/g, '_').toLowerCase();
    const isManagerOrAdmin = ['manager', 'super_admin', 'admin'].includes(normalizedRole);
    const genericPlaceholders = ['operator', 'transporter', 'agent', 'shipper ops', 'sales person', 'shipper_ops', 'sales_person'];
    const trimmedUserName = (userName || '').toLowerCase().trim();
    const isGenericRole = genericPlaceholders.some(p => normalizedRole.includes(p) || trimmedUserName.includes(p));
    const isGenericName = !userName || genericPlaceholders.includes(trimmedUserName) || isGenericRole;
    const normalizedQueue = (queue || 'all-work').toLowerCase().trim();

    if (normalizedQueue === 'unassigned') {
      query.assignee = { $in: ['Unassigned', 'unassigned', null, ''] };
    } else if (normalizedQueue === 'open') {
      query.status = { $regex: /^open$/i };
    }

    if (!isManagerOrAdmin && !isGenericName) {
      const cleanName = userName.includes('@') ? userName.split('@')[0] : userName;
      query.$or = [
        { assignee: new RegExp(`^${userName}$`, 'i') },
        { assignedTo: new RegExp(`^${userName}$`, 'i') },
        { subAssignment: new RegExp(`^${userName}$`, 'i') },
        { assignee: new RegExp(cleanName, 'i') }
      ];
    }

    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }
    
    const tickets = await this.ticketModel.find(query).sort({ createdAt: -1 }).exec();
    return tickets.map((t: any) => {
      const ticketObj = t.toObject ? t.toObject() : t;
      const hasSubAssignment = ticketObj.subAssignment && ticketObj.subAssignment !== 'Unassigned' && ticketObj.subAssignment !== '';
      if (hasSubAssignment && !ticketObj.subAssignmentAt) {
        ticketObj.subAssignmentAt = ticketObj.updatedAt || ticketObj.createdAt;
      }
      return ticketObj;
    });
  }

  async findOne(id: string, companyId: string): Promise<Ticket | null> {
    const baseQuery = id.startsWith('INC-') ? { ticketId: id } : { _id: id };
    const ticket = await this.ticketModel.findOne({ ...baseQuery, companyId }).exec();
    if (!ticket) return null;
    const ticketObj: any = ticket.toObject ? ticket.toObject() : ticket;
    const hasSubAssignment = ticketObj.subAssignment && ticketObj.subAssignment !== 'Unassigned' && ticketObj.subAssignment !== '';
    if (hasSubAssignment && !ticketObj.subAssignmentAt) {
      ticketObj.subAssignmentAt = ticketObj.updatedAt || ticketObj.createdAt;
    }
    return ticketObj;
  }

  async getStats(companyId: string, userRole?: string, userName?: string) {
    const query: any = { companyId };
    if (userRole && userName) {
      const normalizedRole = userRole.replace(/\s+/g, '_').toLowerCase();
      const isManagerOrAdmin = ['manager', 'super_admin', 'admin'].includes(normalizedRole);
      const genericPlaceholders = ['operator', 'transporter', 'agent', 'shipper ops', 'sales person', 'shipper_ops', 'sales_person'];
      const trimmedUserName = (userName || '').toLowerCase().trim();
      const isGenericRole = genericPlaceholders.some(p => normalizedRole.includes(p) || trimmedUserName.includes(p));
      const isGenericName = genericPlaceholders.includes(trimmedUserName) || isGenericRole;
      if (!isManagerOrAdmin && !isGenericName) {
        const cleanName = userName.includes('@') ? userName.split('@')[0] : userName;
        query.$or = [
          { assignee: new RegExp(`^${userName}$`, 'i') },
          { assignedTo: new RegExp(`^${userName}$`, 'i') },
          { subAssignment: new RegExp(`^${userName}$`, 'i') },
          { assignee: new RegExp(cleanName, 'i') }
        ];
      }
    }
    const tickets = await this.ticketModel.find(query).exec();
    const categoryStats = tickets.reduce((acc: any, ticket) => {
      const cat = ticket.category || 'Uncategorized';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    const resolvedByOperatorStats = tickets.reduce((acc: any, ticket) => {
      const status = (ticket.status || '').toLowerCase();
      const isResolved = ['resolved', 'closed', 'completed', 'done'].includes(status);
      
      if (isResolved) {
        const resolvedBy = this.getEffectiveResolver(ticket);
        acc[resolvedBy] = (acc[resolvedBy] || 0) + 1;
      }
      return acc;
    }, {});
    
    return {
      total: tickets.length,
      open: tickets.filter((t) => (t.status || '').toLowerCase() === 'open').length,
      resolved: tickets.filter((t) => ['resolved', 'closed', 'completed', 'done'].includes((t.status || '').toLowerCase())).length,
      byCategory: categoryStats,
      resolvedByOperator: resolvedByOperatorStats,
    };
  }

  async findAllSla(companyId: string): Promise<SlaConfig[]> {
    return this.slaConfigModel.find({ companyId }).exec();
  }

  async removeSlaConfig(id: string, companyId: string) {
    return await this.slaConfigModel.findOneAndDelete({ _id: id, companyId }).exec();
  }
}