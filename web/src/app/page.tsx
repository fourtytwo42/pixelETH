import PixelCanvas from '@/components/PixelCanvas';
import WalletConnection from '@/components/WalletConnection';
import { Card, CardBody } from '@/components/ui/Card';

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-56px)]">
      {/* HERO */}
      <section className="container-hero pt-8 pb-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight gradient-title">
            PixelETH
          </h1>
          <p className="mt-3 text-lg opacity-80 max-w-2xl mx-auto">
            A decentralized pixel art game on the blockchain. Buy pixels, paint the canvas, and compete in team-based strategy!
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Wallet Connection */}
          <div className="xl:col-span-1">
            <WalletConnection />
            
            {/* Game Stats */}
            <Card className="mt-4">
              <CardBody>
                <h3 className="text-lg font-semibold mb-3">Game Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-red-500">🔴 Red Team:</span>
                    <span id="red-count">-</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-500">🔵 Blue Team:</span>
                    <span id="blue-count">-</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Base Price:</span>
                    <span id="base-price">-</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Canvas Size:</span>
                    <span id="canvas-size">-</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* How to Play */}
            <Card className="mt-4">
              <CardBody>
                <h3 className="text-lg font-semibold mb-3">How to Play</h3>
                <div className="text-sm space-y-2">
                  <p>🎨 <strong>Click pixels</strong> to buy and paint them</p>
                  <p>⚡ <strong>Choose team:</strong> Red or Blue affects pricing</p>
                  <p>📈 <strong>Prices increase</strong> by 1.5x when resold</p>
                  <p>💰 <strong>Sellers get 90%</strong> back, treasury gets 10%</p>
                  <p>🔄 <strong>Self-buy</strong> to change color/team</p>
                  <p>🏆 <strong>Team balance</strong> affects multiplier pricing</p>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Pixel Canvas */}
          <div className="xl:col-span-3">
            <PixelCanvas />
          </div>
        </div>
      </section>
    </main>
  );
}
