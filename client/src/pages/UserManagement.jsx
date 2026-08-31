import React, { useState, useEffect } from "react";
import {
  UserPlus,
  Edit3,
  UserCheck,
  UserX,
  Trash2,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { USER_ROLES } from "../utils/constants";

export const UserManagement = () => {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const initialForm = {
    name: "",
    email: "",
    role: "Operator",
    avatarColor: "#2563eb",
    password: "",
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user?.companyId) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get("/users");
        
        const filteredUsers = response.data.filter(
          (u) => String(u.companyId) === String(user.companyId),
        );
        setUsers(filteredUsers);
      } catch (error) {
        console.error("Failed to fetch users", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, [user]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      ...initialForm,
      avatarColor: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (userObj) => {
    const normalizedUser = { ...userObj, _id: userObj._id || userObj.id };
    setEditingUser(normalizedUser);
    setFormData({
      name: normalizedUser.name,
      email: normalizedUser.email,
      role: normalizedUser.role,
      avatarColor: normalizedUser.avatarColor,
      password: "",
    });
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (targetUser) => {
    if (!isAdmin) return;
    const targetId = targetUser._id || targetUser.id;
    const newStatus = targetUser.status === "Active" ? "Inactive" : "Active";
    try {
      await api.patch(`/users/${targetId}`, { status: newStatus });
      setUsers(
        users.map((u) =>
          (u._id || u.id) === targetId ? { ...u, status: newStatus } : u,
        ),
      );
    } catch (error) {
      alert("Failed to update status");
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) return;
    if (
      window.confirm(
        "Are you sure? This user will be permanently removed from your company.",
      )
    ) {
      try {
        await api.delete(`/users/${id}`);
        setUsers(users.filter((u) => (u._id || u.id) !== id));
      } catch (error) {
        alert(
          "Failed to delete user: " +
            (error.response?.data?.message || error.message),
        );
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, companyId: user.companyId };
      if (editingUser && !payload.password) {
        delete payload.password;
      }

      if (editingUser) {
        const userId = editingUser._id || editingUser.id;
        if (!userId) {
          alert("Error: User ID is missing. Please close the modal and try editing again.");
          return;
        }
        const { data } = await api.patch(`/users/${userId}`, payload);
        setUsers(users.map((u) => ((u._id || u.id) === userId ? data : u)));
      } else {
        const { data } = await api.post("/users", payload);
        setUsers([...users, data]);
      }
      setIsModalOpen(false);
      setFormData(initialForm);
    } catch (error) {
      console.error("Save Error Details:", error.response?.data || error);
      const errorMessage =
        error.response?.data?.message || "An unexpected error occurred.";
      const displayMessage = Array.isArray(errorMessage)
        ? errorMessage.join(", ")
        : errorMessage;
      alert(`Error saving user: ${displayMessage}`);
    }
  };

  return (
    <div className="h-full flex flex-col font-sans bg-white text-slate-800">
      {/* Header section adjusted for responsive stacking */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 sm:px-6 py-4 border-b border-slate-200 shrink-0 gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#13203B]">
            User & Role Management
          </h1>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
            Managing team members for Company:{" "}
            {user?.companyName || "Loading..."}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow-sm flex items-center justify-center gap-1.5"
          >
            <UserPlus size={16} /> Add User
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          {isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
            </div>
          ) : (
            /* Wrapped table container with overflow-x-auto for mobile horizontal scrolling */
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm text-slate-600 border-collapse min-w-[650px]">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">User</th>
                    <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">Email</th>
                    <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">Role</th>
                    <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">Status</th>
                    {isAdmin && <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.length > 0 ? (
                    users.map((u) => {
                      const rowId = u._id || u.id;
                      return (
                        <tr
                          key={rowId}
                          className="hover:bg-slate-50 transition-colors text-sm"
                        >
                          <td className="p-4 font-semibold text-slate-900 flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0"
                              style={{ backgroundColor: u.avatarColor }}
                            >
                              {u.name?.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate max-w-[150px] sm:max-w-none">{u.name}</span>
                          </td>
                          <td className="p-4 text-slate-600 truncate max-w-[180px] sm:max-w-none">{u.email}</td>
                          <td className="p-4 font-medium text-slate-700">{u.role}</td>
                          <td className="p-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block ${
                                u.status === "Active" 
                                  ? "bg-emerald-100 text-emerald-800" 
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {u.status || "Active"}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="p-4 text-right space-x-1 whitespace-nowrap">
                              <button
                                onClick={() => handleOpenEdit(u)}
                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                                title="Edit User"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                                title="Toggle Status"
                              >
                                {u.status === "Active" ? (
                                  <UserX size={16} className="text-rose-500" />
                                ) : (
                                  <UserCheck size={16} className="text-emerald-500" />
                                )}
                              </button>
                              <button
                                onClick={() => handleDelete(rowId)}
                                className="p-2 hover:bg-slate-100 rounded-lg text-rose-500 transition"
                                title="Delete User"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="p-12 text-center text-slate-400 italic text-base">
                        No users found for this company.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 sm:p-6 shadow-2xl my-auto">
            <h3 className="font-bold text-base text-slate-800 mb-5 flex items-center gap-2">
              <ShieldAlert size={20} className="text-blue-600 shrink-0" />
              {editingUser ? "Edit User Details" : "Create New User"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 text-xs uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 text-xs uppercase tracking-wider">
                  Email
                </label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 text-xs uppercase tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder={
                    editingUser
                      ? "Leave blank to keep current"
                      : "Enter password"
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5 text-xs uppercase tracking-wider">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {USER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5 text-xs uppercase tracking-wider">
                    Avatar Color
                  </label>
                  <input
                    type="color"
                    value={formData.avatarColor}
                    onChange={(e) =>
                      setFormData({ ...formData, avatarColor: e.target.value })
                    }
                    className="w-full h-10 rounded-xl cursor-pointer border border-slate-300 bg-slate-50 p-1"
                  />
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition shadow-sm"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};