import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Invoice, Contact } from "@/lib/db/schema";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32 },
  title: { fontSize: 20, fontWeight: 700 },
  meta: { color: "#666", marginTop: 4 },
  section: { marginBottom: 24 },
  label: { color: "#666", fontSize: 9, textTransform: "uppercase", marginBottom: 2 },
  table: { marginTop: 8 },
  tableRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#e5e5e5" },
  tableHeader: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#333", fontWeight: 700 },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1, textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16 },
  totalLabel: { fontSize: 13, marginRight: 12 },
  totalValue: { fontSize: 13, fontWeight: 700 },
});

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function InvoicePdfDocument({ invoice, contact }: { invoice: Invoice; contact: Contact }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Invoice {invoice.number}</Text>
            <Text style={styles.meta}>{invoice.createdAt.toLocaleDateString()}</Text>
          </View>
          <View>
            <Text style={styles.label}>Status</Text>
            <Text>{invoice.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Bill to</Text>
          <Text>{contact.name}</Text>
          <Text>{contact.phone}</Text>
          {contact.email && <Text>{contact.email}</Text>}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Unit price</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {invoice.lineItems.map((li, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={styles.colDesc}>{li.description}</Text>
              <Text style={styles.colQty}>{li.quantity}</Text>
              <Text style={styles.colPrice}>
                {formatCents(li.unitPrice * 100, invoice.currency)}
              </Text>
              <Text style={styles.colTotal}>
                {formatCents(li.quantity * li.unitPrice * 100, invoice.currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {formatCents(invoice.totalCents, invoice.currency)}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
