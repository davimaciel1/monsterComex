import { CompanyCard } from '../CompanyCard';

export default function CompanyCardExample() {
  return (
    <div className="p-8 space-y-4 max-w-2xl">
      <CompanyCard
        id={1}
        name="ACME Corporation"
        kind="importer"
        countryCode="US"
        score={0.95}
        onClick={() => console.log('Company clicked')}
      />
      <CompanyCard
        id={2}
        name="Global Exports Ltd"
        kind="exporter"
        countryCode="BR"
        score={0.87}
        onClick={() => console.log('Company clicked')}
      />
    </div>
  );
}
