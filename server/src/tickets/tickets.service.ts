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
import { EmailNotificationService } from '../utils/email-notification.service';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(SlaConfig.name) private slaConfigModel: Model<SlaConfigDocument>,
    @InjectModel('User') private userModel: Model<any>,
    private readonly ticketsGateway: TicketsGateway,
    private readonly emailNotificationService: EmailNotificationService,
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

  private getEffectiveResolver(ticket: any, fallbackTicket?: any, updatePayload?: any): string {
    const payloadSub = updatePayload?.subAssignment;
    if (payloadSub && typeof payloadSub === 'string' && payloadSub !== 'Unassigned' && payloadSub.trim() !== '' && payloadSub !== 'null') {
      return payloadSub.trim();
    }

    const ticketSub = ticket?.subAssignment;
    if (ticketSub && typeof ticketSub === 'string' && ticketSub !== 'Unassigned' && ticketSub.trim() !== '' && ticketSub !== 'null') {
      return ticketSub.trim();
    }

    const fallbackSub = fallbackTicket?.subAssignment;
    if (fallbackSub && typeof fallbackSub === 'string' && fallbackSub !== 'Unassigned' && fallbackSub.trim() !== '' && fallbackSub !== 'null') {
      return fallbackSub.trim();
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
      const resolvedCompanyId = companyId || createTicketDto.companyId || 'openport123';
      const normalizedRole = (userRole || '').replace(/\s+/g, '_').toLowerCase();
      const isSalesRole = normalizedRole.includes('sales');

      if (isSalesRole) {
        if (createTicketDto.category) {
          throw new ForbiddenException('Sales Ops are not allowed to choose the category.');
        }
        if (createTicketDto.issueType) {
          throw new ForbiddenException('Sales Ops are not allowed to choose the incident type.');
        }
      }

      const restrictedAssignmentKeywords = ['transporter', 'sales', 'shipper', 'ops'];

      if (createTicketDto.assignee && createTicketDto.assignee !== 'Unassigned') {
        const lowerAssignee = createTicketDto.assignee.toLowerCase();
        const isRestricted = restrictedAssignmentKeywords.some(keyword => lowerAssignee.includes(keyword));
        if (isRestricted) {
          throw new BadRequestException('Action forbidden: Transporters, Sales Persons, and Shipper Ops cannot be assigned tickets.');
        }
      }

      if (createTicketDto.subAssignment && createTicketDto.subAssignment !== 'Unassigned' && createTicketDto.subAssignment !== '') {
        const lowerSub = createTicketDto.subAssignment.toLowerCase();
        const isRestrictedSub = restrictedAssignmentKeywords.some(keyword => lowerSub.includes(keyword));
        if (isRestrictedSub) {
          throw new BadRequestException('Action forbidden: Transporters, Sales Persons, and Shipper Ops cannot be given sub-assignments.');
        }
      }

      const isAssigned = createTicketDto.assignee && createTicketDto.assignee !== 'Unassigned';
      const isSubAssigned = createTicketDto.subAssignment && createTicketDto.subAssignment !== 'Unassigned' && createTicketDto.subAssignment !== '';

      if (isAssigned && isSubAssigned) {
        if (createTicketDto.assignee?.trim().toLowerCase() === createTicketDto.subAssignment?.trim().toLowerCase()) {
          throw new BadRequestException('The assignee and sub-assignee cannot be the same person.');
        }
      }

      const category = createTicketDto.category || null;
      let deadline: Date | null = null;
      let ticketPriority = createTicketDto.priority || 'Medium';

      if (category) {
        const slaConfig = await this.slaConfigModel.findOne({ category, companyId: resolvedCompanyId }).exec();
        const hoursAllowed = slaConfig ? slaConfig.hours : 24;
        deadline = new Date(Date.now() + hoursAllowed * 60 * 60 * 1000);
        if (slaConfig && slaConfig.priority) {
          ticketPriority = slaConfig.priority;
        }
      }

      const resolvedUserName = userName && userName !== 'User' ? userName : 'Ali';
      const ticketGenerator = createTicketDto.generator || `${resolvedUserName} (${userRole || 'Super Admin'})`;

      const ticketData = {
        ...createTicketDto,
        title: createTicketDto.title || 'Untitled Ticket',
        description: createTicketDto.description || '',
        source: createTicketDto.source || 'Manual Web Form',
        issueType: createTicketDto.issueType || 'General Support',
        category,
        type: createTicketDto.type || 'Incident',
        priority: ticketPriority,
        status: 'Open',
        assignee: isAssigned ? createTicketDto.assignee : 'Unassigned',
        subAssignment: isSubAssigned ? createTicketDto.subAssignment : null,
        ticketId: (createTicketDto as any).ticketId || `INC-${Math.floor(10000 + Math.random() * 90000)}`,
        slaDeadline: deadline,
        assignedAt: isAssigned ? new Date() : null,
        subAssignmentAt: isSubAssigned ? new Date() : null,
        resolvedAt: null,
        companyId: resolvedCompanyId,
        generator: ticketGenerator,
        createdBy: userId || null,
      };

      const createdTicket = new this.ticketModel(ticketData);
      const savedTicket = await createdTicket.save();

      this.ticketsGateway.emitTicketCreated(savedTicket, resolvedCompanyId);
      return savedTicket;
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException) throw error;
      this.logger.error(`Failed to create ticket: ${error.message}`);
      throw new InternalServerErrorException(`Could not create ticket: ${error.message}`);
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
    const isSalesRole = normalizedRole.includes('sales');
    const restrictedUpdateRoles = ['operator', 'transporter', 'shipper_ops', 'sales_person', 'sales'];

    if (isSalesRole || restrictedUpdateRoles.some(r => normalizedRole.includes(r))) {
      if (updateTicketDto.category !== undefined) {
        throw new ForbiddenException('You are not allowed to update Category.');
      }

      if (updateTicketDto.issueType !== undefined) {
        throw new ForbiddenException('You are not allowed to update Incident Type.');
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

    const restrictedAssignmentKeywords = ['transporter', 'sales', 'shipper', 'ops'];

    if (updateTicketDto.assignee && updateTicketDto.assignee !== 'Unassigned') {
      const lowerAssignee = updateTicketDto.assignee.toLowerCase();
      const isRestricted = restrictedAssignmentKeywords.some(keyword => lowerAssignee.includes(keyword));
      if (isRestricted) {
        throw new BadRequestException('Action forbidden: Transporters, Sales Persons, and Shipper Ops cannot be assigned tickets.');
      }
    }

    if (updateTicketDto.subAssignment && updateTicketDto.subAssignment !== '' && updateTicketDto.subAssignment !== 'Unassigned') {
      const lowerSub = updateTicketDto.subAssignment.toLowerCase();
      const isRestrictedSub = restrictedAssignmentKeywords.some(keyword => lowerSub.includes(keyword));
      if (isRestrictedSub) {
        throw new BadRequestException('Action forbidden: Transporters, Sales Persons, and Shipper Ops cannot be given sub-assignments.');
      }
    }

    const baseQuery = id.startsWith('INC-') ? { ticketId: id } : { _id: id };
    const existingTicket = await this.ticketModel.findOne({ ...baseQuery, companyId });
    if (!existingTicket) throw new NotFoundException(`Ticket with ID ${id} not found`);

    const oldPrimaryAssigneeName = existingTicket.assignee;
    const oldSubAssignmentName = existingTicket.subAssignment;
    const oldSlaStatus = (existingTicket as any).slaStatus;

    const targetAssignee = updateTicketDto.assignee !== undefined ? updateTicketDto.assignee : existingTicket.assignee;
    const targetSubAssignment = updateTicketDto.subAssignment !== undefined ? updateTicketDto.subAssignment : existingTicket.subAssignment;

    const isTargetAssigned = targetAssignee && targetAssignee !== 'Unassigned' && targetAssignee !== '';
    const isTargetSubAssigned = targetSubAssignment && targetSubAssignment !== 'Unassigned' && targetSubAssignment !== '' && targetSubAssignment !== null;

    if (isTargetAssigned && isTargetSubAssigned) {
      if (targetAssignee?.trim().toLowerCase() === targetSubAssignment?.trim().toLowerCase()) {
        throw new BadRequestException('The assignee and sub-assignee cannot be the same person.');
      }
    }

    const currentStatus = (existingTicket.status || '').toLowerCase();
    const isAlreadyResolved = ['resolved', 'completed', 'done'].includes(currentStatus);

    if (isAlreadyResolved) {
      const isChangingCategory = updateTicketDto.category !== undefined && updateTicketDto.category !== existingTicket.category;
      const isChangingSubAssignment = updateTicketDto.subAssignment !== undefined && updateTicketDto.subAssignment !== existingTicket.subAssignment;

      if (isChangingCategory || isChangingSubAssignment) {
        throw new BadRequestException('Cannot modify category or sub-assignment once a ticket is resolved.');
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

    if (updateData.category !== undefined) {
      if (updateData.category) {
        const slaConfig = await this.slaConfigModel.findOne({ category: updateData.category, companyId }).exec();
        const hoursAllowed = slaConfig ? slaConfig.hours : 24;
        updateData.slaDeadline = new Date(Date.now() + hoursAllowed * 60 * 60 * 1000);
        if (slaConfig && slaConfig.priority) {
          updateData.priority = slaConfig.priority;
        }
      } else {
        updateData.category = null;
        updateData.slaDeadline = null;
      }
    } else {
      delete updateData.slaDeadline;
    }

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
          updateData.subAssignmentAt = updateData.subAssignmentAt ? new Date(updateData.subAssignmentAt) : new Date();
        } else {
          updateData.subAssignmentAt = existingTicket.subAssignmentAt;
        }
      } else {
        updateData.subAssignment = null;
        updateData.subAssignmentAt = null;
      }
    } else if (existingTicket.subAssignment) {
      updateData.subAssignment = existingTicket.subAssignment;
      updateData.subAssignmentAt = existingTicket.subAssignmentAt;
    }

    let isNewResolved = false;
    if (updateData.status !== undefined && updateData.status !== existingTicket.status) {
      isNewResolved = ['resolved', 'completed', 'done'].includes(updateData.status.toLowerCase());
      if (isNewResolved) {
        updateData.resolvedAt = new Date();
      } else {
        updateData.resolvedAt = null;
      }
    }

    const updatedTicket = await this.ticketModel
      .findOneAndUpdate({ ...baseQuery, companyId }, updateData, { new: true, runValidators: true })
      .exec();

    if (!updatedTicket) {
      throw new NotFoundException(`Ticket with ID ${id} could not be updated`);
    }

    // 📧 Trigger email notification with robust debug logs
    try {
      this.logger.debug(`[Email Debug] Checking updates - Assignee changed from "${oldPrimaryAssigneeName}" to "${updateData.assignee}"`);

      const resolveUserObj = async (identifier: string | null | undefined) => {
        if (!identifier || identifier === 'Unassigned') return null;
        const foundUser = await this.userModel.findOne({ 
          companyId, 
          $or: [
            { name: new RegExp(`^${identifier}$`, 'i') }, 
            { fullName: new RegExp(`^${identifier}$`, 'i') },
            { username: new RegExp(`^${identifier}$`, 'i') },
            { email: new RegExp(`^${identifier}$`, 'i') }
          ] 
        });
        if (foundUser) {
          this.logger.debug(`[Email Debug] Resolved user object for "${identifier}": email -> ${foundUser.email}`);
          return foundUser;
        }
        const fallbackObj = { name: identifier, email: identifier.includes('@') ? identifier : `${identifier.toLowerCase().replace(/\s+/g, '')}@example.com` };
        this.logger.debug(`[Email Debug] User not found in DB for "${identifier}", using fallback object: email -> ${fallbackObj.email}`);
        return fallbackObj;
      };

      // 1. Primary Assignee Changed Notification
      if (updateData.assignee !== undefined && updateData.assignee !== oldPrimaryAssigneeName) {
        const oldAssigneeObj = await resolveUserObj(oldPrimaryAssigneeName);
        const newAssigneeObj = await resolveUserObj(updateData.assignee);

        if (typeof this.emailNotificationService.sendPrimaryAssigneeChangedEmail === 'function') {
          this.logger.log(`[Email Debug] Dispatching sendPrimaryAssigneeChangedEmail...`);
          await this.emailNotificationService.sendPrimaryAssigneeChangedEmail(oldAssigneeObj, newAssigneeObj, updatedTicket);
        }
      }

      // 2. Sub-Assignee Added / Changed Notification
      if (updateData.subAssignment !== undefined && updateData.subAssignment !== oldSubAssignmentName) {
        const primaryAssigneeObj = await resolveUserObj(updatedTicket.assignee);
        const subAssigneeObj = await resolveUserObj(updateData.subAssignment);

        if (subAssigneeObj && typeof this.emailNotificationService.sendSubAssigneeAddedEmail === 'function') {
          this.logger.log(`[Email Debug] Dispatching sendSubAssigneeAddedEmail...`);
          await this.emailNotificationService.sendSubAssigneeAddedEmail(primaryAssigneeObj, subAssigneeObj, updatedTicket);
        }
      }

      // 3. Manager SLA Breach Alert Notification
      const newSlaStatus = (updatedTicket as any).slaStatus;
      if (oldSlaStatus !== 'Breached' && newSlaStatus === 'Breached') {
        if (typeof this.emailNotificationService.sendBreachEmailToManager === 'function') {
          this.logger.log(`[Email Debug] Dispatching sendBreachEmailToManager...`);
          await this.emailNotificationService.sendBreachEmailToManager(updatedTicket);
        }
      }
    } catch (emailErr: any) {
      this.logger.error(`Failed to dispatch email notifications: ${emailErr.message}`);
    }

    if (isNewResolved && !isAlreadyResolved) {
      const targetUser = this.getEffectiveResolver(updatedTicket, existingTicket, updateTicketDto);

      if (targetUser && targetUser !== 'Unassigned') {
        try {
          await this.userModel.findOneAndUpdate(
            { 
              companyId, 
              $or: [
                { name: new RegExp(`^${targetUser}$`, 'i') }, 
                { fullName: new RegExp(`^${targetUser}$`, 'i') },
                { username: new RegExp(`^${targetUser}$`, 'i') },
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
      query.title = { $regex: search,$options: 'i' };
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
      const isResolved = ['resolved', 'completed', 'done'].includes(status);

      if (isResolved) {
        const resolvedBy = this.getEffectiveResolver(ticket);
        acc[resolvedBy] = (acc[resolvedBy] || 0) + 1;
      }
      return acc;
    }, {});

    return {
      total: tickets.length,
      open: tickets.filter((t) => (t.status || '').toLowerCase() === 'open').length,
      resolved: tickets.filter((t) => ['resolved', 'completed', 'done'].includes((t.status || '').toLowerCase())).length,
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