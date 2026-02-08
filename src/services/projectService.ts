import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
    limit
} from 'firebase/firestore';
import { db } from '@/lib/firestore';
import { Project, ProjectInput } from '@/types/project';
import { clientService } from './clientService';

const COLLECTION_NAME = 'projects';

// Mock Data
let mockProjects: Project[] = [];
const isMock = !db.type;

export const projectService = {
    // GET All (Active by default, or all?)
    // For Kanban we need ALL projects that are not 'done' maybe? 
    // Or just fetch all and filter in memory since dataset is small for MVP.
    async getProjects(clientId?: string): Promise<Project[]> {
        if (isMock) {
            if (clientId) return mockProjects.filter(p => p.clientId === clientId);
            return mockProjects;
        }

        try {
            const projectsRef = collection(db, COLLECTION_NAME);
            let q;

            if (clientId) {
                // Simplified query to avoid need for Composite Index (clientId ASC, updatedAt DESC)
                // We can sort in memory if needed, or create index later.
                q = query(projectsRef, where('clientId', '==', clientId));
            } else {
                q = query(projectsRef, orderBy('updatedAt', 'desc'), limit(200));
            }

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Project));
        } catch (error) {
            console.error("Error fetching projects:", error);
            // Fallback for missing index error on first run
            if (isMock) return mockProjects;
            return [];
        }
    },

    async getProject(id: string): Promise<Project | null> {
        if (isMock) return mockProjects.find(p => p.id === id) || null;

        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                return { id: snapshot.id, ...snapshot.data() } as Project;
            }
            return null;
        } catch (error) {
            console.error("Error fetching project:", error);
            return null;
        }
    },

    async createProject(data: ProjectInput): Promise<string> {
        if (isMock) {
            const newProject: Project = {
                id: `mock-p-${Date.now()}`,
                ...data,
                clientName: 'Mock Client',
                startedAt: null,
                deployedAt: null,
                createdAt: { toDate: () => new Date() },
                updatedAt: { toDate: () => new Date() },
            };
            mockProjects.push(newProject);
            return newProject.id;
        }

        try {
            // Fetch client name for snapshot
            const client = await clientService.getClient(data.clientId);
            const clientName = client?.fullName || 'Unknown Client';

            const projectsRef = collection(db, COLLECTION_NAME);
            const now = serverTimestamp();

            const docRef = await addDoc(projectsRef, {
                ...data,
                clientName,
                startedAt: null,
                deployedAt: null,
                createdAt: now,
                updatedAt: now
            });
            return docRef.id;
        } catch (error) {
            console.error("Error creating project:", error);
            throw error;
        }
    },

    async updateProject(id: string, data: Partial<Project>): Promise<void> {
        if (isMock) {
            mockProjects = mockProjects.map(p => {
                if (p.id !== id) return p;

                // Mock logic for auto-timestamps
                let startedAt = p.startedAt;
                if (data.pipelineStage === 'building' && !startedAt) {
                    startedAt = { toDate: () => new Date() };
                }

                return { ...p, ...data, startedAt, updatedAt: { toDate: () => new Date() } };
            });
            return;
        }

        try {
            const docRef = doc(db, COLLECTION_NAME, id);

            // Logic: If moving to 'building' and no startedAt, set it
            const updates: any = { ...data, updatedAt: serverTimestamp() };

            // We need to check current state if we want to be safe, 
            // but for simplicity we'll trust the caller OR just set it if provided in data.
            // Actually, the UX logic said "Project Service" handles it? 
            // Let's do it optimistically: if data.pipelineStage is 'building', try to set startedAt if not set.
            // But we can't know if it's already set without reading. 
            // Firestore rules could handle this, or we just read-modify-write, or we use update logic.

            // For now, let's assume the UI sends the specific field update if needed, 
            // OR we do a quick read. A quick read is safer.
            if (data.pipelineStage === 'building') {
                const current = await getDoc(docRef);
                const currentData = current.data() as Project;
                if (current.exists() && !currentData.startedAt) {
                    updates.startedAt = serverTimestamp();
                }
            }

            // Note: DeployedAt logic is manual per requirements for now.

            await updateDoc(docRef, updates);
        } catch (error) {
            console.error("Error updating project:", error);
            throw error;
        }
    },

    async deleteProject(id: string): Promise<void> {
        if (isMock) {
            mockProjects = mockProjects.filter(p => p.id !== id);
            return;
        }

        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting project:", error);
            throw error;
        }
    },

    // Stats for Dashboard
    async getDashboardStats() {
        // In a real app with many projects, we'd use aggregation queries or counters.
        // For MVP, valid to fetch all active projects and counts.
        const all = await this.getProjects();

        const building = all.filter(p => p.pipelineStage === 'building').length;
        const deploy = all.filter(p => p.pipelineStage === 'deploy').length;
        const fixes = all.filter(p => p.pipelineStage === 'fixes').length;

        // Avg age of active
        const active = all.filter(p => p.status === 'active' && p.createdAt);
        let avgDays = 0;
        if (active.length > 0) {
            const now = new Date().getTime();
            const totalMs = active.reduce((acc, p) => {
                const created = (p.createdAt as Timestamp)?.toDate?.().getTime() || Date.now();
                return acc + (now - created);
            }, 0);
            avgDays = Math.round((totalMs / active.length) / (1000 * 60 * 60 * 24));
        }

        return {
            building,
            deploy,
            fixes,
            avgActiveDays: avgDays
        };
    }
};
