import Image from 'next/image';
import nextLogo from './../../public/assets/next.png';

export default function Footer() {
  return (
    <footer className="w-full bg-white dark:bg-black text-center py-4 border-t">
      <p className="text-black dark:text-white">Powered by Next.js and Alyra</p>
      <div className="flex justify-center items-center mt-2">
        <Image 
          src={nextLogo}
          alt="Next.js Logo" 
          width={100} 
          height={20}
          className="dark:invert"
          priority
        />
      </div>
    </footer>
  );
}