/**
 * Future: swap implementation to call /api/* endpoints for DB-private architecture.
 */

import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    where,
    orderBy,
    limit,
    Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firestore';
import { Project, ProjectInput } from '@/schemas/project';
import { getClient } from './clients'; // Cross-DAL/service call

const COLLECTION_NAME = 'projects';

// Mock Data
let mockProjects: Project[] = [];
const isMock = !db.type;

export async function listProjects(clientId?: string): Promise<Project[]> {
    if (isMock) {
        if (clientId) return mockProjects.filter(p => p.clientId === clientId);
        return mockProjects;
    }

    try {
        const projectsRef = collection(db, COLLECTION_NAME);
        let q;

        if (clientId) {
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
        // Fallback for missing index error
        if (isMock) return mockProjects;
        return [];
    }
}

export async function getProject(id: string): Promise<Project | null> {
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
}

export async function createProject(data: ProjectInput): Promise<string> {
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
        const client = await getClient(data.clientId);
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
}

export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
    if (isMock) {
        mockProjects = mockProjects.map(p => {
            if (p.id !== id) return p;

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
        // Use Omit to allow serverTimestamp (FieldValue) instead of Timestamp
        const updates: Omit<Partial<Project>, 'updatedAt' | 'startedAt'> & { updatedAt: unknown, startedAt?: unknown } = { ...data, updatedAt: serverTimestamp() };

        if (data.pipelineStage === 'building') {
            const current = await getDoc(docRef);
            const currentData = current.data() as Project;
            if (current.exists() && !currentData.startedAt) {
                updates.startedAt = serverTimestamp();
            }
        }

        await updateDoc(docRef, updates);
    } catch (error) {
        console.error("Error updating project:", error);
        throw error;
    }
}

export async function deleteProject(id: string): Promise<void> {
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
}

export async function getDashboardStats() {
    // In a real app with many projects, we'd use aggregation queries or counters.
    // For MVP, valid to fetch all active projects and counts.
    const all = await listProjects();

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
