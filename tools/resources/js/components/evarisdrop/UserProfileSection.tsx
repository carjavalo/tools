import { useState } from 'react';
import { User, Edit2, Check, X, LogIn } from 'lucide-react';
import ToolCard from '@/components/ToolCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RoomCodeDisplay } from './RoomCodeDisplay';

interface UserProfileSectionProps {
  username: string;
  roomCode: string;
  onUsernameChange: (username: string) => void;
  onGenerateNewUsername: () => void;
  onJoinRoom?: (roomCode: string) => void;
}

export function UserProfileSection({ 
  username, 
  roomCode, 
  onUsernameChange, 
  onGenerateNewUsername,
  onJoinRoom 
}: UserProfileSectionProps) {
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editedUsername, setEditedUsername] = useState(username);
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);
  const [joinRoomCode, setJoinRoomCode] = useState('');

  const handleSaveUsername = () => {
    if (editedUsername.trim()) {
      onUsernameChange(editedUsername.trim());
      setIsEditingUsername(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedUsername(username);
    setIsEditingUsername(false);
  };



  const handleJoinRoom = () => {
    if (joinRoomCode.trim() && onJoinRoom) {
      onJoinRoom(joinRoomCode.trim().toUpperCase());
      setJoinRoomCode('');
      setIsJoinRoomOpen(false);
    }
  };

  return (
    <ToolCard
      title="Perfil de Usuario"
      description="Tu información de sesión"
    >
        {/* Username Section */}
        <div className="space-y-2">
          <Label htmlFor="username">Nombre de Usuario</Label>
          <div className="flex items-center gap-2">
            {isEditingUsername ? (
              <>
                <Input
                  id="username"
                  value={editedUsername}
                  onChange={(e) => setEditedUsername(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveUsername();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
                <Button size="sm" variant="ghost" onClick={handleSaveUsername}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                  <X className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 px-3 py-2 bg-muted rounded-md text-sm">
                  {username}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingUsername(true)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onGenerateNewUsername}
            className="text-xs border-institutional text-institutional hover:bg-institutional/10"
          >
            Generar Usuario Aleatorio
          </Button>
        </div>

        {/* Room Code Section */}
        <div className="space-y-2">
          <Label>Código de Sala</Label>
          <RoomCodeDisplay roomCode={roomCode} />
          {onJoinRoom && (
            <Dialog open={isJoinRoomOpen} onOpenChange={setIsJoinRoomOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full bg-institutional hover:bg-institutional/90">
                  <LogIn className="w-4 h-4 mr-2" />
                  Unirse a Sala
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Unirse a Sala Privada</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="join-room-code">Código de Sala</Label>
                    <Input
                      id="join-room-code"
                      placeholder="Ej: ABCD-1234"
                      value={joinRoomCode}
                      onChange={(e) => setJoinRoomCode(e.target.value)}
                      className="uppercase"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleJoinRoom();
                      }}
                    />
                  </div>
                  <Button 
                    onClick={handleJoinRoom} 
                    className="w-full bg-institutional hover:bg-institutional/90" 
                    disabled={!joinRoomCode.trim()}
                  >
                    Unirse a Sala
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>


    </ToolCard>
  );
}