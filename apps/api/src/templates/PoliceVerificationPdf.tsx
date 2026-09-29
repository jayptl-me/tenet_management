import React from 'react';
import { Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer';

// ── Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '2 solid #1F2937',
    paddingBottom: 10,
    marginBottom: 10,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 15,
  },
  photoBox: {
    width: 80,
    height: 95,
    border: '1 dashed #9CA3AF',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  photoPlaceholderText: {
    fontSize: 7,
    color: '#6B7280',
    textAlign: 'center',
    padding: 4,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  subTitle: {
    fontSize: 8,
    color: '#4B5563',
    marginBottom: 4,
  },
  pgName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#047857',
    marginTop: 2,
  },
  pgAddress: {
    fontSize: 8,
    color: '#4B5563',
    lineHeight: 1.3,
  },
  section: {
    marginBottom: 8,
    border: '1 solid #E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#F3F4F6',
    color: '#111827',
    padding: '4 8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    borderBottom: '1 solid #E5E7EB',
  },
  sectionContent: {
    padding: '5 8',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  col2: {
    width: '50%',
    paddingRight: 8,
  },
  col3: {
    width: '33.33%',
    paddingRight: 6,
  },
  col4: {
    width: '25%',
    paddingRight: 4,
  },
  label: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  value: {
    fontSize: 8.5,
    color: '#111827',
  },
  valueBold: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  highlightBox: {
    backgroundColor: '#FEF3C7',
    border: '1 solid #FCD34D',
    borderRadius: 2,
    padding: '2 4',
  },
  declarationText: {
    fontSize: 7.5,
    lineHeight: 1.4,
    color: '#374151',
    marginBottom: 4,
  },
  signSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTop: '1 dashed #D1D5DB',
  },
  signBlock: {
    width: '30%',
    textAlign: 'center',
  },
  signLine: {
    height: 30,
    borderBottom: '1 solid #4B5563',
    marginBottom: 4,
  },
  signLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
  },
  signSub: {
    fontSize: 6.5,
    color: '#6B7280',
  },
  policeStampBox: {
    width: '32%',
    height: 60,
    border: '1 dashed #6B7280',
    borderRadius: 4,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  policeStampText: {
    fontSize: 6.5,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export interface PoliceVerificationPdfProps {
  tenant: {
    name: string;
    phone: string;
    email: string;
    roomNumber: string;
    floorLabel: string;
    bedId: string;
    moveInDate: string;
    monthlyRent: number;
    depositPaid: number;
    photoUrl?: string;
  };
  pg: {
    name: string;
    address: string;
    phone?: string;
    email?: string;
    ownerName?: string;
    policeStation?: string;
  };
  profile?: {
    fatherOrSpouseName?: string;
    dob?: string;
    gender?: string;
    bloodGroup?: string;
    identificationMark?: string;
    permanentAddress?: {
      street?: string;
      city?: string;
      district?: string;
      state?: string;
      pincode?: string;
      policeStation?: string;
    };
    occupation?: {
      category?: string;
      organizationName?: string;
      officeAddress?: string;
      idNumber?: string;
      contactPhone?: string;
    };
    localReferences?: Array<{
      name?: string;
      phone?: string;
      address?: string;
      relation?: string;
    }>;
    stayPurpose?: string;
  };
  emergencyContact?: {
    name?: string;
    phone?: string;
    relation?: string;
  };
  documentInfo?: {
    type: string;
    numberMasked: string;
    isVerified: boolean;
  };
}

export function PoliceVerificationPdf({
  tenant,
  pg,
  profile,
  emergencyContact,
  documentInfo,
}: PoliceVerificationPdfProps) {
  const perm = profile?.permanentAddress;
  const occ = profile?.occupation;
  const refs = profile?.localReferences || [];
  const ref1 = refs[0];
  const ref2 = refs[1];

  const permAddressStr = [
    perm?.street,
    perm?.city,
    perm?.district,
    perm?.state ? `${perm.state} - ${perm?.pincode || ''}` : perm?.pincode,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Document title={`Police-Verification-${tenant.name}`} author="Tenet PG Management">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Tenant / Resident Verification Intimation Form</Text>
            <Text style={styles.subTitle}>
              For Mandatory Police Submission (Under Sec 223 BNS & State Police Tenant Directives)
            </Text>
            <Text style={styles.pgName}>{pg.name || 'Paying Guest Accommodation'}</Text>
            <Text style={styles.pgAddress}>{pg.address || 'Address not specified'}</Text>
            {pg.policeStation ? (
              <Text style={styles.pgAddress}>
                Local Police Jurisdiction: <Text style={styles.valueBold}>{pg.policeStation}</Text>
              </Text>
            ) : null}
          </View>

          {/* Photo Box */}
          <View style={styles.photoBox}>
            {tenant.photoUrl ? (
              <Image src={tenant.photoUrl} style={styles.photoImage} />
            ) : (
              <Text style={styles.photoPlaceholderText}>Affix Recent Passport Photo Here</Text>
            )}
          </View>
        </View>

        {/* Section 1: Resident Personal Particulars */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Resident Personal Details</Text>
          <View style={styles.sectionContent}>
            <View style={styles.row}>
              <View style={styles.col2}>
                <Text style={styles.label}>Full Legal Name</Text>
                <Text style={styles.valueBold}>{tenant.name}</Text>
              </View>
              <View style={styles.col2}>
                <Text style={styles.label}>Father / Spouse Name</Text>
                <Text style={styles.value}>{profile?.fatherOrSpouseName || 'Not specified'}</Text>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.col4}>
                <Text style={styles.label}>Date of Birth / Age</Text>
                <Text style={styles.value}>{profile?.dob || 'Not specified'}</Text>
              </View>
              <View style={styles.col4}>
                <Text style={styles.label}>Gender</Text>
                <Text style={styles.value}>
                  {profile?.gender ? profile.gender.toUpperCase() : 'Not specified'}
                </Text>
              </View>
              <View style={styles.col4}>
                <Text style={styles.label}>Mobile Number</Text>
                <Text style={styles.valueBold}>{tenant.phone}</Text>
              </View>
              <View style={styles.col4}>
                <Text style={styles.label}>Blood Group</Text>
                <Text style={styles.value}>{profile?.bloodGroup || 'Not specified'}</Text>
              </View>
            </View>

            {profile?.identificationMark ? (
              <View style={styles.row}>
                <View style={{ width: '100%' }}>
                  <Text style={styles.label}>Visible Identification Mark</Text>
                  <Text style={styles.value}>{profile.identificationMark}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* Section 2: Permanent Address Details (Native Place) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Permanent Address Details (Native Place)</Text>
          <View style={styles.sectionContent}>
            <View style={styles.row}>
              <View style={{ width: '65%', paddingRight: 8 }}>
                <Text style={styles.label}>Permanent / Native Address</Text>
                <Text style={styles.value}>
                  {permAddressStr || 'Permanent address not specified'}
                </Text>
              </View>
              <View style={{ width: '35%' }}>
                <Text style={styles.label}>Native Police Station Jurisdiction</Text>
                <View style={styles.highlightBox}>
                  <Text style={styles.valueBold}>
                    {perm?.policeStation || 'Police Station not specified'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Section 3: Occupation / Educational Institution Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Workplace / Educational Details</Text>
          <View style={styles.sectionContent}>
            <View style={styles.row}>
              <View style={styles.col3}>
                <Text style={styles.label}>Occupation Category</Text>
                <Text style={styles.value}>
                  {occ?.category ? occ.category.toUpperCase() : 'Not specified'}
                </Text>
              </View>
              <View style={styles.col3}>
                <Text style={styles.label}>College / Company Name</Text>
                <Text style={styles.valueBold}>{occ?.organizationName || 'Not specified'}</Text>
              </View>
              <View style={styles.col3}>
                <Text style={styles.label}>ID / Enrollment No.</Text>
                <Text style={styles.value}>{occ?.idNumber || 'Not specified'}</Text>
              </View>
            </View>
            {occ?.officeAddress ? (
              <View style={styles.row}>
                <View style={{ width: '100%' }}>
                  <Text style={styles.label}>College / Office Address & Contact</Text>
                  <Text style={styles.value}>
                    {occ.officeAddress} {occ.contactPhone ? `(Ph: ${occ.contactPhone})` : ''}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* Section 4: PG Accommodation & Emergency Contacts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Accommodation & Emergency Contact</Text>
          <View style={styles.sectionContent}>
            <View style={styles.row}>
              <View style={styles.col4}>
                <Text style={styles.label}>Assigned Room & Bed</Text>
                <Text style={styles.valueBold}>
                  Room {tenant.roomNumber} ({tenant.floorLabel}) · Bed {tenant.bedId}
                </Text>
              </View>
              <View style={styles.col4}>
                <Text style={styles.label}>Move-in Date</Text>
                <Text style={styles.value}>{tenant.moveInDate}</Text>
              </View>
              <View style={styles.col4}>
                <Text style={styles.label}>Monthly Rent</Text>
                <Text style={styles.value}>Rs {tenant.monthlyRent.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.col4}>
                <Text style={styles.label}>Deposit Paid</Text>
                <Text style={styles.value}>Rs {tenant.depositPaid.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            <View style={[styles.row, { marginTop: 3 }]}>
              <View style={styles.col2}>
                <Text style={styles.label}>Emergency Contact Person</Text>
                <Text style={styles.value}>
                  {emergencyContact?.name || 'Not specified'}{' '}
                  {emergencyContact?.relation ? `(${emergencyContact.relation})` : ''}
                </Text>
              </View>
              <View style={styles.col2}>
                <Text style={styles.label}>Emergency Phone Number</Text>
                <Text style={styles.valueBold}>{emergencyContact?.phone || 'Not specified'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 5: Local City References (Mandatory in Police Orders) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Two Local References / Guarantors in City</Text>
          <View style={styles.sectionContent}>
            <View style={styles.row}>
              <View style={styles.col2}>
                <Text style={styles.label}>Reference 1 (Name & Phone)</Text>
                <Text style={styles.valueBold}>
                  {ref1?.name || 'Local Reference 1'} - {ref1?.phone || 'Phone pending'}
                </Text>
                <Text style={styles.subTitle}>
                  {ref1?.address || 'Address pending'} {ref1?.relation ? `(${ref1.relation})` : ''}
                </Text>
              </View>
              <View style={styles.col2}>
                <Text style={styles.label}>Reference 2 (Name & Phone)</Text>
                <Text style={styles.valueBold}>
                  {ref2?.name || 'Local Reference 2'} - {ref2?.phone || 'Phone pending'}
                </Text>
                <Text style={styles.subTitle}>
                  {ref2?.address || 'Address pending'} {ref2?.relation ? `(${ref2.relation})` : ''}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 6: Attached ID Credential */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Verified Government Identity Proof</Text>
          <View style={styles.sectionContent}>
            <View style={styles.row}>
              <View style={styles.col3}>
                <Text style={styles.label}>Document Type Attached</Text>
                <Text style={styles.valueBold}>
                  {documentInfo?.type
                    ? documentInfo.type.toUpperCase().replace('_', ' ')
                    : 'GOVT ID'}
                </Text>
              </View>
              <View style={styles.col3}>
                <Text style={styles.label}>Document Number (Masked)</Text>
                <Text style={styles.valueBold}>
                  {documentInfo?.numberMasked || 'XXXX-XXXX-XXXX'}
                </Text>
              </View>
              <View style={styles.col3}>
                <Text style={styles.label}>Verification Status</Text>
                <Text style={styles.value}>
                  {documentInfo?.isVerified ? 'VERIFIED BY MANAGEMENT' : 'PENDING VERIFICATION'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 7: Statutory Declaration & Undertakings */}
        <View style={{ marginTop: 4, marginBottom: 6 }}>
          <Text style={styles.declarationText}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Tenant Declaration: </Text>I hereby
            solemnly declare that all information furnished above is true and correct to the best of
            my knowledge. I have not been convicted by any Court of Law, nor is any criminal
            proceeding or investigation pending against me in any police station or court in India.
          </Text>
          <Text style={styles.declarationText}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Landlord Undertaking: </Text>I hereby
            certify that I have verified the original identity proof and admission/employment
            details of the tenant before letting out the above accommodation.
          </Text>
        </View>

        {/* Section 8: Signatures & Police Inward Stamp */}
        <View style={styles.signSection}>
          <View style={styles.signBlock}>
            <View style={styles.signLine} />
            <Text style={styles.signLabel}>Signature of Tenant</Text>
            <Text style={styles.signSub}>Date: {new Date().toLocaleDateString('en-IN')}</Text>
          </View>

          <View style={styles.signBlock}>
            <View style={styles.signLine} />
            <Text style={styles.signLabel}>Landlord / PG Manager Signature & Seal</Text>
            <Text style={styles.signSub}>Date: {new Date().toLocaleDateString('en-IN')}</Text>
          </View>

          <View style={styles.policeStampBox}>
            <Text style={styles.policeStampText}>Police Station Inward Stamp</Text>
            <Text style={styles.policeStampText}>& Signature of SHO / Duty Officer</Text>
            <Text style={styles.policeStampText}>(For Police Record)</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
