// User roles updated to match: Super Admin, Manager, Operator
export const USER_ROLES = ['Super Admin', 'Manager', 'Operator'];

// Workflow transitions for ticket management
export const WORKFLOW_TRANSITIONS = {
  Incident: {
    New: ['In Progress', 'Resolved'],
    'In Progress': ['Pending Approval', 'Resolved'],
    'Pending Approval': ['In Progress', 'Resolved'],
    Resolved: ['Closed', 'Reopened'],
    Closed: ['Reopened'],
    Reopened: ['In Progress', 'Resolved'],
  },
  'Service Request': {
    New: ['Pending Approval', 'In Progress'],
    'Pending Approval': ['Approved', 'Closed'],
    Approved: ['In Progress', 'Fulfilled'],
    'In Progress': ['Fulfilled'],
    Fulfilled: ['Closed'],
    Closed: [],
  },
  Change: {
    New: ['Pending Approval'],
    'Pending Approval': ['Approved', 'Closed'],
    Approved: ['In Progress'],
    'In Progress': ['Resolved'],
    Resolved: ['Closed'],
    Closed: [],
  },
  Problem: {
    New: ['In Progress'],
    'In Progress': ['Resolved'],
    Resolved: ['Closed'],
    Closed: [],
  },
};