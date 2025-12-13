'use client';

import { useState } from 'react';
import { Plus, Trash, Star, Hammer, User } from 'lucide-react';
import { updateProjectAction } from '@/app/actions';

interface Contact {
    id: string;
    name: string;
    type: 'private' | 'company' | 'subcontractor';
    role?: string;
}

interface TeamMember {
    contactId: string;
    role: string;
    isMainContact?: boolean;
}

interface Props {
    projectId: string;
    initialTeam: TeamMember[];
    contacts: Contact[];
    onUpdate?: () => void;
}

export function ProjectTeam({ projectId, initialTeam = [], contacts, onUpdate }: Props) {
    const [team, setTeam] = useState<TeamMember[]>(initialTeam);
    const [isAdding, setIsAdding] = useState(false);
    const [selectedContactId, setSelectedContactId] = useState('');
    const [selectedRole, setSelectedRole] = useState('');

    const handleAdd = async () => {
        if (!selectedContactId) return;

        const contact = contacts.find(c => c.id === selectedContactId);
        const role = selectedRole || contact?.role || 'Resurs';

        const newTeam = [...team, { contactId: selectedContactId, role, isMainContact: false }];

        // Optimistic Update
        setTeam(newTeam);
        setIsAdding(false);
        setSelectedContactId('');
        setSelectedRole('');

        // Server Update
        await updateProjectAction(projectId, { team: newTeam });
        if (onUpdate) onUpdate();
    };

    const handleRemove = async (contactId: string) => {
        const newTeam = team.filter(m => m.contactId !== contactId);
        setTeam(newTeam);
        await updateProjectAction(projectId, { team: newTeam });
        if (onUpdate) onUpdate();
    };

    const toggleMainContact = async (contactId: string) => {
        const newTeam = team.map(m =>
            m.contactId === contactId ? { ...m, isMainContact: !m.isMainContact } : m
        );
        setTeam(newTeam);
        await updateProjectAction(projectId, { team: newTeam });
    };

    // Filter out already added contacts
    const availableContacts = contacts.filter(c => !team.find(t => t.contactId === c.id));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Hammer size={18} className="text-primary" /> Projektgrupp & UE
                </h3>
            </div>

            <div className="space-y-3">
                {team.map(member => {
                    const contact = contacts.find(c => c.id === member.contactId);
                    if (!contact) return null;

                    return (
                        <div key={member.contactId} className="flex items-center justify-between bg-card p-3 rounded-lg border border-border shadow-sm group">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                                    ${contact.type === 'subcontractor' ? 'bg-blue-900/50 text-blue-200' : 'bg-zinc-800 text-zinc-300'}`}>
                                    {contact.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-medium text-sm flex items-center gap-2">
                                        {contact.name}
                                        {member.isMainContact && (
                                            <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 font-semibold">
                                                ANSVARIG
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{member.role}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => toggleMainContact(member.contactId)}
                                    title="Sätt som ansvarig"
                                    className={`p-1.5 rounded-md transition-colors ${member.isMainContact ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-500 hover:bg-zinc-800'}`}
                                >
                                    <Star size={14} fill={member.isMainContact ? "currentColor" : "none"} />
                                </button>
                                <button
                                    onClick={() => handleRemove(member.contactId)}
                                    title="Ta bort från projekt"
                                    className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                                >
                                    <Trash size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {/* Add New UI */}
                {isAdding ? (
                    <div className="bg-card p-3 rounded-lg border border-dashed border-border flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
                        <select
                            className="input-field text-sm"
                            value={selectedContactId}
                            onChange={(e) => {
                                const c = contacts.find(x => x.id === e.target.value);
                                setSelectedContactId(c?.id || '');
                                if (c?.role) setSelectedRole(c.role);
                            }}
                        >
                            <option value="">Välj kontakt...</option>
                            {availableContacts.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} ({c.type === 'subcontractor' ? 'UE' : 'Kund'})
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            list="role-suggestions"
                            placeholder="Roll i projektet (t.ex. Elektriker)"
                            className="input-field text-sm"
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                        />
                        <datalist id="role-suggestions">
                            <option value="Elektriker" />
                            <option value="VVS-installatör" />
                            <option value="Snickare" />
                            <option value="Målare" />
                            <option value="Plåtslagare" />
                            <option value="Markentreprenör" />
                            <option value="Arkitekt" />
                            <option value="Konstruktör" />
                            <option value="KA (Kontrollansvarig)" />
                            <option value="Projektledare" />
                        </datalist>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsAdding(false)} className="text-xs text-muted-foreground hover:text-white px-2">Avbryt</button>
                            <button onClick={handleAdd} disabled={!selectedContactId} className="btn-primary text-xs py-1.5">Lägg till</button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="w-full py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus size={16} /> Lägg till deltagare
                    </button>
                )}
            </div>
        </div>
    );
}
