const jwt = require('jsonwebtoken');

// 1. Authentication Middleware (Verifies who the user is)
const authMiddleware = (req, res, next) => {
  console.log("DEBUG: Request hitting authMiddleware! URL:", req.originalUrl);
  
  const authHeader = req.headers.authorization;
  console.log("DEBUG: Received Authorization Header:", authHeader);

  // Check if header exists and starts with 'Bearer'
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("DEBUG: FAILED - No token or invalid format in Authorization header");
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("DEBUG: Token verified successfully. User data:", decoded);
    req.user = decoded; // Attaching user data to the request
    next();
  } catch (err) {
    console.error("DEBUG: JWT Verification FAILED. Error:", err.message);
    // If the token expired, err.message will say 'jwt expired'
    res.status(403).json({ message: "Invalid or expired token" });
  }
};

// 2. Permission Middleware
const authorize = (requiredActions) => {
  return (req, res, next) => {
    // Safety check: Ensure req.user exists
    if (!req.user) {
        console.log("DEBUG: Forbidden - No req.user found in authorize middleware");
        return res.status(401).json({ message: "Authentication required" });
    }

    const userRole = req.user.role; 
    console.log("DEBUG: Checking authorization for User Role:", userRole);

    const rolePermissions = {
      "Super Admin": ["description", "status", "assignee", "category", "sla"],
      "Manager":     ["description", "status", "assignee", "category", "sla"],
      "Operator":    ["description", "status"]
    };

    const allowedActions = rolePermissions[userRole] || [];
    const hasPermission = requiredActions.every(action => allowedActions.includes(action));

    if (!hasPermission) {
      console.log(`DEBUG: FORBIDDEN. User role '${userRole}' does not have access to: ${requiredActions}`);
      return res.status(403).json({ message: "Forbidden: You do not have permission." });
    }
    
    console.log("DEBUG: Authorization passed for:", requiredActions);
    next();
  };
};

module.exports = { authMiddleware, authorize };