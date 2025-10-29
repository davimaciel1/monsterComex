import { Header } from '../Header';

export default function HeaderExample() {
  return (
    <>
      <Header onSearch={(q) => console.log('Search:', q)} />
      <div className="p-8">
        <p className="text-muted-foreground">Header without search bar</p>
      </div>
      <Header compact onSearch={(q) => console.log('Search:', q)} />
      <div className="p-8">
        <p className="text-muted-foreground">Compact header with search bar</p>
      </div>
    </>
  );
}
