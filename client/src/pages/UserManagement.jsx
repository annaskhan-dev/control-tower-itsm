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
        // FIXED: Replaced api.users() with the correct API method
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

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      avatarColor: user.avatarColor,
      password: "",
    });
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (targetUser) => {
    if (!isAdmin) return;
    const newStatus = targetUser.status === "Active" ? "Inactive" : "Active";
    try {
      await api.patch(`/users/${targetUser.id}`, { status: newStatus });
      setUsers(
        users.map((u) =>
          u.id === targetUser.id ? { ...u, status: newStatus } : u,
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
        setUsers(users.filter((u) => u.id !== id));
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
        const { data } = await api.patch(`/users/${editingUser.id}`, payload);
        setUsers(users.map((u) => (u.id === editingUser.id ? data : u)));
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
    <div className="h-full flex flex-col space-y-3 font-sans overflow-hidden p-4">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="font-bold text-xl text-[#13203B]">
            User & Role Management
          </h2>
          <p className="text-xs text-slate-500">
            Managing team members for Company:{" "}
            {user?.companyName || "Loading..."}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <UserPlus size={14} /> Add User
          </button>
        )}
      </div>

      <div className="flex-1 border border-slate-200 rounded-2xl overflow-y-auto bg-white shadow-sm">
        {isLoading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="animate-spin text-blue-600" />
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 font-semibold text-slate-500">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                {isAdmin && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length > 0 ? (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="p-3 font-semibold text-slate-800 flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ backgroundColor: u.avatarColor }}
                      >
                        {u.name?.charAt(0).toUpperCase()}
                      </div>
                      {u.name}
                    </td>
                    <td className="p-3 text-slate-600">{u.email}</td>
                    <td className="p-3 font-medium text-slate-700">{u.role}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
                      >
                        {u.status || "Active"}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                        >
                          {u.status === "Active" ? (
                            <UserX size={14} className="text-rose-500" />
                          ) : (
                            <UserCheck size={14} className="text-emerald-500" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="p-1.5 hover:bg-slate-100 rounded text-rose-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-slate-500">
                    No users found for this company.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl">
            <h3 className="font-bold text-sm text-slate-800 mb-4 flex items-center gap-2">
              <ShieldAlert size={16} className="text-blue-600" />
              {editingUser ? "Edit User Details" : "Create New User"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Email
                </label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
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
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {USER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">
                    Avatar Color
                  </label>
                  <input
                    type="color"
                    value={formData.avatarColor}
                    onChange={(e) =>
                      setFormData({ ...formData, avatarColor: e.target.value })
                    }
                    className="w-full h-9 rounded-xl cursor-pointer border-0"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
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