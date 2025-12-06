import 'server-only';
import { getFirestore } from 'firebase-admin/firestore';

// Define the Recipe Interface
// "materialåtgång, tidsåtgång, risker (KMA)"
export interface Recipe {
    id: string;
    name: string;
    description?: string;
    materials: {
        name: string;
        unit: string; // e.g., 'm2', 'st'
        costPerUnit: number;
        quantityPerUnit: number; // Consumption per unit of the recipe's base unit
    }[];
    laborHoursPerUnit: number; // Time per unit
    riskFactor: number; // e.g., 0.10 for 10%
    kmaRequirements?: string[]; // List of KMA flags e.g., 'chemicals', 'height'
}

import { db } from './server';
const collectionName = 'recipes';

export const RecipeRepo = {
    async get(id: string): Promise<Recipe | null> {
        const doc = await db.collection(collectionName).doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as Recipe;
    },

    async list(): Promise<Recipe[]> {
        const snapshot = await db.collection(collectionName).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
    },

    async create(data: Omit<Recipe, 'id'>): Promise<Recipe> {
        const docRef = await db.collection(collectionName).add(data);
        return { id: docRef.id, ...data };
    }
};
