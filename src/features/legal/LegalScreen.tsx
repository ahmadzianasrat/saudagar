import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import { colors } from "../../theme";
import { PageHeader } from "../../components/ui";
import { LEGAL_CONTENT, type LegalDoc } from "./legalContent";

const VALID_DOCS: LegalDoc[] = ["about", "terms", "privacy"];

export default function LegalScreen() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { doc } = useParams<{ doc: string }>();

  const resolvedDoc: LegalDoc = VALID_DOCS.includes(doc as LegalDoc) ? (doc as LegalDoc) : "about";
  const content = LEGAL_CONTENT[language][resolvedDoc];

  return (
    <div style={{ padding: 16, paddingBottom: 28 }}>
      <PageHeader title={content.title} onBack={() => navigate(-1)} />
      <p style={{ fontSize: 11.5, color: colors.textFaint, margin: "-8px 0 16px" }}>{content.updated}</p>

      {content.intro && (
        <p style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 1.6, margin: "0 0 20px" }}>{content.intro}</p>
      )}

      <div style={{ display: "grid", gap: 20 }}>
        {content.sections.map((section, i) => (
          <section key={i}>
            <h2 style={{ fontSize: 14.5, fontWeight: 700, color: colors.textPrimary, margin: "0 0 6px" }}>{section.heading}</h2>
            <p style={{ fontSize: 13.5, color: colors.textSecondary, lineHeight: 1.7, margin: 0 }}>{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
