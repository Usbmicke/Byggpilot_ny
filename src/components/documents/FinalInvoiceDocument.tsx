import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Define styles
const styles = StyleSheet.create({
    page: { padding: 40, backgroundColor: '#FFFFFF', fontFamily: 'Helvetica' },
    header: { fontSize: 24, marginBottom: 20, color: '#1a1a1a', fontWeight: 'bold' },
    section: { margin: 10, padding: 10 },
    text: { fontSize: 11, marginBottom: 5, color: '#333' },
    table: { width: 'auto', borderStyle: 'solid', borderWidth: 1, borderColor: '#eee', marginBottom: 20 },
    tableRow: { margin: 'auto', flexDirection: 'row' },
    tableCol: { width: '25%', borderStyle: 'solid', borderWidth: 1, borderColor: '#eee', padding: 5 },
    tableCell: { margin: 5, fontSize: 10 },
    bold: { fontWeight: 'bold' },
    total: { marginTop: 20, fontSize: 14, fontWeight: 'bold', alignSelf: 'flex-end' },
    footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 10, color: '#999' }
});

interface InvoiceProps {
    project: any;
    offer: any;
    changeOrders: any[];
    company: any;
}

export const FinalInvoiceDocument = ({ project, offer, changeOrders, company }: InvoiceProps) => (
    <Document>
        <Page size="A4" style={styles.page}>

            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 }}>
                <View>
                    <Text style={styles.header}>SLUTFAKTURA</Text>
                    <Text style={styles.text}>Faktura nr: {Math.floor(Math.random() * 10000)}</Text>
                    <Text style={styles.text}>Datum: {new Date().toLocaleDateString('sv-SE')}</Text>
                </View>
                <View>
                    <Text style={[styles.text, styles.bold]}>{company?.name || 'Byggföretaget AB'}</Text>
                    <Text style={styles.text}>{company?.address || 'Storgatan 1'}</Text>
                    <Text style={styles.text}>{company?.email || 'info@bygg.se'}</Text>
                </View>
            </View>

            {/* Customer Info */}
            <View style={{ marginBottom: 30, backgroundColor: '#f9fafb', padding: 15, borderRadius: 4 }}>
                <Text style={[styles.text, { color: '#666', fontSize: 9 }]}>KUND</Text>
                <Text style={[styles.text, styles.bold]}>{project.customerName}</Text>
                <Text style={styles.text}>{project.address}</Text>
            </View>

            {/* Main Offer Items */}
            <Text style={[styles.section, { fontSize: 14, fontWeight: 'bold' }]}>Originaloffert</Text>
            <View style={styles.table}>
                <View style={[styles.tableRow, { backgroundColor: '#f3f4f6' }]}>
                    <View style={[styles.tableCol, { width: '50%' }]}><Text style={[styles.tableCell, styles.bold]}>Beskrivning</Text></View>
                    <View style={[styles.tableCol, { width: '15%' }]}><Text style={[styles.tableCell, styles.bold]}>Antal</Text></View>
                    <View style={[styles.tableCol, { width: '15%' }]}><Text style={[styles.tableCell, styles.bold]}>A-pris</Text></View>
                    <View style={[styles.tableCol, { width: '20%' }]}><Text style={[styles.tableCell, styles.bold]}>Totalt</Text></View>
                </View>
                {offer?.items?.map((item: any, i: number) => (
                    <View style={styles.tableRow} key={i}>
                        <View style={[styles.tableCol, { width: '50%' }]}><Text style={styles.tableCell}>{item.description}</Text></View>
                        <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{item.quantity} {item.unit}</Text></View>
                        <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{item.unitPrice}</Text></View>
                        <View style={[styles.tableCol, { width: '20%' }]}><Text style={styles.tableCell}>{item.quantity * item.unitPrice}</Text></View>
                    </View>
                ))}
            </View>

            {/* ÄTA Items */}
            <Text style={[styles.section, { fontSize: 14, fontWeight: 'bold', marginTop: 10 }]}>ÄTA (Ändringar & Tillägg)</Text>
            <View style={styles.table}>
                <View style={[styles.tableRow, { backgroundColor: '#fff7ed' }]}>
                    <View style={[styles.tableCol, { width: '50%' }]}><Text style={[styles.tableCell, styles.bold]}>Beskrivning</Text></View>
                    <View style={[styles.tableCol, { width: '15%' }]}><Text style={[styles.tableCell, styles.bold]}>Antal</Text></View>
                    <View style={[styles.tableCol, { width: '15%' }]}><Text style={[styles.tableCell, styles.bold]}>Pris/st</Text></View>
                    <View style={[styles.tableCol, { width: '20%' }]}><Text style={[styles.tableCell, styles.bold]}>Totalt</Text></View>
                </View>
                {changeOrders.length === 0 && (
                    <View style={styles.tableRow}>
                        <View style={[styles.tableCol, { width: '100%', borderBottom: 0 }]}><Text style={styles.tableCell}>Inga tillägg registrerade.</Text></View>
                    </View>
                )}
                {changeOrders.map((ata: any, i: number) => (
                    <View style={styles.tableRow} key={i}>
                        <View style={[styles.tableCol, { width: '50%' }]}><Text style={styles.tableCell}>{ata.description} ({ata.type})</Text></View>
                        <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{ata.quantity} st</Text></View>
                        <View style={[styles.tableCol, { width: '15%' }]}><Text style={styles.tableCell}>{ata.estimatedCost / ata.quantity}</Text></View>
                        <View style={[styles.tableCol, { width: '20%' }]}><Text style={styles.tableCell}>{ata.estimatedCost}</Text></View>
                    </View>
                ))}
            </View>

            {/* Totals */}
            <View style={styles.total}>
                <Text>Att betala (exkl moms): {
                    (offer?.totalAmount || 0) + changeOrders.reduce((sum: number, c: any) => sum + (c.estimatedCost || 0), 0)
                } kr</Text>
                <Text style={{ fontSize: 10, color: '#666', marginTop: 5 }}>Moms (25%): {
                    ((offer?.totalAmount || 0) + changeOrders.reduce((sum: number, c: any) => sum + (c.estimatedCost || 0), 0)) * 0.25
                } kr</Text>
                <Text style={{ fontSize: 16, marginTop: 10 }}>Totalt att betala: {
                    ((offer?.totalAmount || 0) + changeOrders.reduce((sum: number, c: any) => sum + (c.estimatedCost || 0), 0)) * 1.25
                } kr</Text>
            </View>

            <Text style={styles.footer}>
                Tack för förtroendet! Betalningsvillkor: 30 dagar. Dröjsmålsränta 8%.
            </Text>
        </Page>
    </Document>
);
