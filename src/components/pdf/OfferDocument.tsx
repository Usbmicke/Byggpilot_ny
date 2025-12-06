import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: '#333',
    },
    header: {
        marginBottom: 20,
        borderBottom: 1,
        borderBottomColor: '#eee',
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    logo: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#4F46E5', // Indigo-600 match
    },
    companyInfo: {
        textAlign: 'right',
        fontSize: 8,
        color: '#666',
    },
    title: {
        fontSize: 24,
        marginBottom: 20,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    section: {
        marginBottom: 10,
    },
    bold: {
        fontWeight: 'bold',
    },
    table: {
        display: 'flex',
        width: 'auto',
        borderStyle: 'solid',
        borderWidth: 1,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderColor: '#eee',
        marginTop: 20,
        marginBottom: 20,
    },
    tableRow: {
        margin: 'auto',
        flexDirection: 'row',
    },
    tableColHeader: {
        width: '20%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderColor: '#eee',
        backgroundColor: '#f9fafb',
        padding: 5,
    },
    tableColDescription: {
        width: '40%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderColor: '#eee',
        padding: 5,
    },
    tableCol: {
        width: '20%',
        borderStyle: 'solid',
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderColor: '#eee',
        padding: 5,
    },
    tableCellHeader: {
        margin: 'auto',
        fontSize: 8,
        fontWeight: 'bold',
    },
    tableCell: {
        margin: 'auto',
        fontSize: 8,
    },
    totals: {
        marginTop: 20,
        flexDirection: 'column',
        alignItems: 'flex-end',
    },
    totalRow: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    totalLabel: {
        width: 100,
        textAlign: 'right',
        paddingRight: 10,
    },
    totalValue: {
        width: 80,
        textAlign: 'right',
        fontWeight: 'bold',
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        fontSize: 8,
        color: '#999',
        borderTop: 1,
        borderColor: '#eee',
        paddingTop: 10,
    }
});

interface OfferDocumentProps {
    data: {
        title: string;
        introText: string;
        items: any[];
        closingText: string;
        totalAmount: number;
        vatAmount: number;
        ownerName?: string; // e.g. "ByggFirman AB"
    }
}

const OfferDocument: React.FC<OfferDocumentProps> = ({ data }) => (
    <Document>
        <Page size="A4" style={styles.page}>

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.logo}>ByggPilot</Text>
                    <Text style={{ fontSize: 8, color: '#666' }}>Din digitala partner</Text>
                </View>
                <View style={styles.companyInfo}>
                    <Text>OFFERT</Text>
                    <Text>Datum: {new Date().toLocaleDateString('sv-SE')}</Text>
                    {/* Valid for 30 days */}
                    <Text>Giltig t.o.m: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE')}</Text>
                </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>{data.title}</Text>

            {/* Intro */}
            <View style={styles.section}>
                <Text>{data.introText}</Text>
            </View>

            {/* Table */}
            <View style={styles.table}>
                <View style={styles.tableRow}>
                    <View style={styles.tableColDescription}>
                        <Text style={styles.tableCellHeader}>Beskrivning</Text>
                    </View>
                    <View style={styles.tableCol}>
                        <Text style={styles.tableCellHeader}>Antal / Enhet</Text>
                    </View>
                    <View style={styles.tableCol}>
                        <Text style={styles.tableCellHeader}>À-pris</Text>
                    </View>
                    <View style={styles.tableCol}>
                        <Text style={styles.tableCellHeader}>Totalt (exkl. moms)</Text>
                    </View>
                </View>

                {data.items.map((item, i) => (
                    <View key={i} style={styles.tableRow}>
                        <View style={styles.tableColDescription}>
                            <Text style={styles.tableCell}>{item.description}</Text>
                        </View>
                        <View style={styles.tableCol}>
                            <Text style={styles.tableCell}>{item.quantity} {item.unit}</Text>
                        </View>
                        <View style={styles.tableCol}>
                            <Text style={styles.tableCell}>{item.unitPrice.toLocaleString('sv-SE')} kr</Text>
                        </View>
                        <View style={styles.tableCol}>
                            <Text style={styles.tableCell}>{(item.quantity * item.unitPrice).toLocaleString('sv-SE')} kr</Text>
                        </View>
                    </View>
                ))}
            </View>

            {/* Totals */}
            <View style={styles.totals}>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Att betala (exkl. moms):</Text>
                    <Text style={styles.totalValue}>{data.totalAmount.toLocaleString('sv-SE')} kr</Text>
                </View>
                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Moms (25%):</Text>
                    <Text style={styles.totalValue}>{data.vatAmount.toLocaleString('sv-SE')} kr</Text>
                </View>
                <View style={[styles.totalRow, { marginTop: 5, borderTop: 1, borderColor: '#333', paddingTop: 5 }]}>
                    <Text style={[styles.totalLabel, styles.bold]}>Totalt att betala:</Text>
                    <Text style={[styles.totalValue, styles.bold, { fontSize: 12 }]}>{(data.totalAmount + data.vatAmount).toLocaleString('sv-SE')} kr</Text>
                </View>
            </View>

            {/* Closing */}
            <View style={[styles.section, { marginTop: 30 }]}>
                <Text>{data.closingText}</Text>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text>Detta dokument är genererat av ByggPilot. Godkännande sker via e-post eller signatur.</Text>
            </View>

        </Page>
    </Document>
);

export default OfferDocument;
