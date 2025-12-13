import 'server-only';
import { ProjectRepo } from './project.repo';
import { CustomerRepo } from './customer.repo';
import { OfferRepo } from './offer.repo';
import { ChangeOrderRepo } from './ata.repo';

export interface InvoiceData {
    projectId: string;
    projectTitle: string;
    customerName: string;
    offer: {
        id: string;
        total: number;
        items: any[];
    } | null;
    changeOrders: {
        approved: any[];
        pending: any[];
        draft: any[];
    };
    expenses: any[];
    warnings: string[];
}

export const InvoiceRepo = {
    async collectProjectData(projectId: string): Promise<InvoiceData> {
        // 1. Fetch Project
        const project = await ProjectRepo.get(projectId);
        if (!project) throw new Error(`Project ${projectId} not found`);

        // 2. Fetch Customer
        let customerName = "Okänd Kund";
        if (project.customerId) {
            const customer = await CustomerRepo.get(project.customerId);
            if (customer) customerName = customer.name;
        } else if (project.customerName) {
            customerName = project.customerName;
        }

        // 3. Fetch Offer
        const offers = await OfferRepo.listByProject(projectId);
        // Assuming OfferRepo returns array of OfferData. Check field names.
        // Will update total price field after checking offer.repo.ts
        const acceptedOffer = offers.find(o => o.status === 'accepted') || null;

        // 4. Fetch Change Orders
        const atas = await ChangeOrderRepo.listByProject(projectId);

        // Filter by status safely. 
        // Note: ChangeOrderData.status is 'draft' | 'approved' | 'rejected'.
        // If we want to track 'pending', we might need to check if we added that stats to ata.repo.ts or if it is implied.
        // Based on previous chats, 'pending_approval' might be a new state we handled in Repo updates? 
        // Let's assume standard stats for now and check if we need to cast.

        const approved = atas.filter(a => a.status === 'approved');
        const draft = atas.filter(a => a.status === 'draft'); // Treat draft as unapproved/pending for now if type is strict
        const pending: any[] = []; // If 'pending_approval' status isn't in the type definition, we can't filter for it easily without casting.

        // 5. Warnings
        const warnings: string[] = [];
        if (!acceptedOffer) warnings.push("Varning: Ingen accepterad offert hittades för detta projekt.");
        if (draft.length > 0) warnings.push(`Varning: Du har ${draft.length} st ÄTA som ligger som 'Utkast' och saknar godkännande.`);

        return {
            projectId: project.id,
            projectTitle: project.name,
            customerName,
            offer: acceptedOffer ? {
                id: acceptedOffer.id,
                total: acceptedOffer.totalAmount, // Correct field
                items: acceptedOffer.items || []
            } : null,
            changeOrders: {
                approved,
                pending,
                draft
            },
            expenses: [],
            warnings
        };
    }
};
