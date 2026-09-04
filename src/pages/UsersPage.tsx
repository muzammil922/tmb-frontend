import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function UsersPage() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: async () => {
      const { data } = await api.get('/admin/users', { params: { search } });
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: string; role?: string }) =>
      api.patch(`/admin/users/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Users</h1>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search users..."
        className="mb-6 w-full max-w-md rounded-lg bg-slate-800 px-4 py-2"
      />
      {isLoading ? <p>Loading...</p> : (
        <div className="overflow-x-auto rounded-xl bg-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-700 text-slate-400">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((user: { id: string; name: string; email: string; role: string; status: string }) => (
                <tr key={user.id} className="border-b border-slate-700/50">
                  <td className="p-4">{user.name}</td>
                  <td className="p-4">{user.email}</td>
                  <td className="p-4">{user.role}</td>
                  <td className="p-4">
                    <span className={`rounded px-2 py-0.5 text-xs ${user.status === 'ACTIVE' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => updateMutation.mutate({ id: user.id, status: user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE' })}
                      className="text-sm text-red-400 hover:underline"
                    >
                      {user.status === 'ACTIVE' ? 'Block' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
