import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Invoice, Contact } from "@/lib/db/schema";

const BRAND_GREEN = "#25D366";

const styles = StyleSheet.create({
  page: { fontSize: 10, fontFamily: "Helvetica", paddingBottom: 40 },
  headerBar: { backgroundColor: BRAND_GREEN, height: 5, width: "100%" },
  content: { paddingHorizontal: 40, paddingTop: 32 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 20, fontWeight: 700, color: "#111827" },
  metaBlock: { alignItems: "flex-end" },
  metaLabel: { fontSize: 8, color: "#6b7280", textTransform: "uppercase" },
  metaValue: { fontSize: 10, color: "#111827", marginBottom: 6 },
  billTo: { marginTop: 28 },
  label: { fontSize: 8, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 },
  billToName: { fontSize: 11, fontWeight: 700, color: "#111827" },
  billToLine: { fontSize: 10, color: "#374151", marginTop: 2 },
  dueBox: {
    marginTop: 24,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 14,
  },
  dueAmount: { fontSize: 15, fontWeight: 700, color: "#111827" },
  dueSub: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  table: { marginTop: 24 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingBottom: 6,
  },
  tableHeaderText: { fontSize: 8, color: "#6b7280", textTransform: "uppercase" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1, textAlign: "right" },
  cellText: { fontSize: 10, color: "#111827" },
  totalsBlock: { marginTop: 4, alignItems: "flex-end" },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 180,
    marginTop: 6,
  },
  totalsLabel: { fontSize: 10, color: "#6b7280" },
  totalsValue: { fontSize: 10, color: "#111827" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 180,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  grandTotalLabel: { fontSize: 11, fontWeight: 700, color: "#111827" },
  grandTotalValue: { fontSize: 11, fontWeight: 700, color: "#111827" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  footerText: { fontSize: 8, color: "#9ca3af" },
});

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function InvoicePdfDocument({ invoice, contact }: { invoice: Invoice; contact: Contact }) {
  return (
    <Document title={`Invoice ${invoice.number}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar} />

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Invoice {invoice.number}</Text>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Issued</Text>
              <Text style={styles.metaValue}>{invoice.createdAt.toLocaleDateString()}</Text>
              {invoice.dueDate && (
                <>
                  <Text style={styles.metaLabel}>Due</Text>
                  <Text style={styles.metaValue}>{invoice.dueDate.toLocaleDateString()}</Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.billTo}>
            <Text style={styles.label}>Bill to</Text>
            <Text style={styles.billToName}>{contact.name}</Text>
            <Text style={styles.billToLine}>{contact.phone}</Text>
            {contact.email && <Text style={styles.billToLine}>{contact.email}</Text>}
          </View>

          <View style={styles.dueBox}>
            <Text style={styles.dueAmount}>
              {formatCents(invoice.totalCents, invoice.currency)} due
              {invoice.dueDate ? ` ${invoice.dueDate.toLocaleDateString()}` : ""}
            </Text>
            <Text style={styles.dueSub}>Status: {invoice.status.toUpperCase()}</Text>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              <Text style={[styles.tableHeaderText, styles.colDesc]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
              <Text style={[styles.tableHeaderText, styles.colPrice]}>Unit price</Text>
              <Text style={[styles.tableHeaderText, styles.colTotal]}>Amount</Text>
            </View>
            {invoice.lineItems.map((li, i) => (
              <View key={i} style={styles.tableRow} wrap={false}>
                <Text style={[styles.cellText, styles.colDesc]}>{li.description}</Text>
                <Text style={[styles.cellText, styles.colQty]}>{li.quantity}</Text>
                <Text style={[styles.cellText, styles.colPrice]}>
                  {formatCents(li.unitPrice * 100, invoice.currency)}
                </Text>
                <Text style={[styles.cellText, styles.colTotal]}>
                  {formatCents(li.quantity * li.unitPrice * 100, invoice.currency)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.totalsBlock}>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>
                {formatCents(invoice.totalCents, invoice.currency)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Invoice {invoice.number} · WhatsApp CRM</Text>
        </View>
      </Page>
    </Document>
  );
}
